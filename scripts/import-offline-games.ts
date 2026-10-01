/* eslint-disable */
/**
 * scripts/import-offline-games.ts
 * --------------------------------------------------------------------
 * Launch backlog importer for the OFFLINE historical games. Reads the game-data
 * Google Sheet (per-player rows), groups by LaserOps_Match_ID, and scores each
 * OFFLINE game with the live admin config via computeOfflineMatchCommit (the
 * exact engine publish uses) -> writes matches + match_player_aggregate.
 *
 * SKIPS the online/hybrid games (handled from JSON/LWA in step C). Does NOT run
 * the XP/Elo recompute - that is step D, run once after ALL games are ingested.
 *
 *   npx tsx scripts/import-offline-games.ts            # DRY RUN (no writes)
 *   npx tsx scripts/import-offline-games.ts --live     # write to the DB
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { computeOfflineMatchCommit, type OfflinePlayerStat } from "../lib/ingestion/offline-commit";
import { getScoringConfig } from "../lib/scoring/config";
import { parseXpConfig } from "../lib/scoring/xp";

const LIVE = process.argv.includes("--live");
const GAME_DATA_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTTLlM4fIfh52DiovbJT2b9A6UyqoiQtoG0c2HoVRCG_OCtLPZvz-uBSC6y1voM8d4jBVCNcpCGctco/pub?gid=116322811&single=true&output=csv";
// Scored elsewhere (online JSON / hybrid JSON+LWA) - never import these as offline.
const SKIP = new Set(["LO-2026-23", "LO-2026-27", "LO-2026-28", "LO-2026-29", "LO-2026-30", "LO-2026-31", "LO-2026-32"]);

const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const toNum = (v: string) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
function toIso(d: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((d || "").trim());
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}
function parseCsv(s: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c === "\r") { /* skip */ }
      else cur += c;
    }
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

async function main() {
  const env: Record<string, string> = {};
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  console.log(`Mode: ${LIVE ? "LIVE (writing)" : "DRY RUN (no writes)"}`);

  // Config: scoring formula + XP config (locked admin values).
  const scoring = await getScoringConfig(sb);
  const { data: xpRows } = await sb.from("xp_config").select("key, value");
  const xpCfg = parseXpConfig((xpRows ?? []) as { key: string; value: number | string | null }[]);

  // Accounts for ops-tag -> accountId resolution.
  const { data: accts } = await sb.from("accounts").select("id, ops_tag");
  const byOps = new Map<string, string>();
  for (const a of (accts ?? []) as { id: string; ops_tag: string | null }[]) if (a.ops_tag) byOps.set(norm(a.ops_tag), a.id);

  // Fetch + parse the sheet.
  const csv = await (await fetch(GAME_DATA_CSV)).text();
  const rows = parseCsv(csv);
  const h = rows[0];
  const ci = (name: string) => h.indexOf(name);
  const COL = {
    match: ci("LaserOps_Match_ID"), date: ci("LaserOps_Game_Date"), team: ci("TeamColor"),
    hb: ci("PlayerNickName"), nick: ci("LaserOps_Nickname"), gun: ci("LaserOps_Gun_Used"),
    frags: ci("PlayerFragsCount"), deaths: ci("PlayerDeathsCount"), hits: ci("PlayerHitsCount"),
    shots: ci("PlayerShotsCount"), wounds: ci("PlayerWoundsCount"), revivals: ci("PlayerRevivalsCount"),
    rw: ci("LaserOps_Rounds_Won"),
  };

  type Row = string[];
  const byMatch = new Map<string, Row[]>();
  for (const r of rows.slice(1)) {
    const m = (r[COL.match] || "").trim();
    if (!m || SKIP.has(m)) continue;
    const list = byMatch.get(m) ?? byMatch.set(m, []).get(m)!;
    list.push(r);
  }

  // Chronological order (date, then code) so later Elo replay is deterministic.
  const games = [...byMatch.keys()].sort((a, b) => {
    const da = toIso(byMatch.get(a)![0][COL.date]) ?? "";
    const db = toIso(byMatch.get(b)![0][COL.date]) ?? "";
    return da === db ? a.localeCompare(b) : da.localeCompare(db);
  });

  const unmatchedGuns = new Set<string>();
  const unmatchedPlayers = new Set<string>();
  let wrote = 0;

  for (const code of games) {
    const rs = byMatch.get(code)!;
    const dateIso = toIso(rs[0][COL.date]);
    // Gun damage at the game's date.
    const { data: gd } = await sb.rpc("all_gun_damage_at", { p_at: dateIso ?? new Date().toISOString().slice(0, 10) });
    const dmgMap = new Map(((gd ?? []) as { name: string; damage: number | null }[]).map((x) => [norm(x.name), Number(x.damage) || 0]));
    const unknownDmg = dmgMap.get(norm("Unknown Gun")) ?? 0;
    const gunDamage = (name: string | null | undefined) => {
      if (!name) return unknownDmg;
      const d = dmgMap.get(norm(name));
      if (d == null) unmatchedGuns.add(name);
      return d ?? unknownDmg;
    };

    // Per-headband identity for this game + player stats.
    const idMap = new Map<string, { nickname: string; accountId: string | null; gun: string | null }>();
    const players: OfflinePlayerStat[] = [];
    const teamRW = new Map<string, number>();
    for (const r of rs) {
      const hb = (r[COL.hb] || "").trim();
      if (!hb) continue;
      const nick = (r[COL.nick] || "").trim();
      const acct = byOps.get(norm(nick)) ?? null;
      if (nick && !acct) unmatchedPlayers.add(nick);
      idMap.set(hb, { nickname: nick || hb, accountId: acct, gun: (r[COL.gun] || "").trim() || null });
      players.push({
        headband: hb, team: (r[COL.team] || "").trim(),
        frags: toNum(r[COL.frags]), deaths: toNum(r[COL.deaths]), hits: toNum(r[COL.hits]),
        shots: toNum(r[COL.shots]), wounds: toNum(r[COL.wounds]), revivals: toNum(r[COL.revivals]),
      });
      teamRW.set((r[COL.team] || "").trim(), toNum(r[COL.rw]));
    }
    // Synthesize round winners from each team's Rounds_Won count.
    const roundWinners: (string | null)[] = [];
    for (const [team, won] of teamRW) for (let i = 0; i < won; i++) roundWinners.push(team);
    const roundResults = roundWinners.map((w) => ({ winnerColour: w }));

    const identity = (hb: string) => idMap.get(hb) ?? { nickname: hb, accountId: null, gun: null };
    const result = computeOfflineMatchCommit(players, roundResults, identity, gunDamage, xpCfg, false, scoring.formula);

    const top = [...result.aggregates].sort((a, b) => b.score - a.score).slice(0, 3).map((a) => `${a.nickname} ${a.score}`).join(", ");
    console.log(`${code}  ${dateIso}  players=${result.aggregates.length}  rounds=${roundResults.length}  winner=${result.winnerColour ?? "-"}  top: ${top}`);

    if (LIVE) {
      const { data: existing } = await sb.from("matches").select("id").eq("match_code", code).maybeSingle();
      let matchId = existing?.id as string | undefined;
      const yr = Number(code.slice(3, 7)) || new Date().getFullYear();
      const seq = Number(code.slice(8)) || null;
      const matchFields = {
        status: "completed", scoring_mode: "offline", played_on: dateIso,
        winning_team_colour: result.winnerColour, net_result_summary: result.netResultSummary,
        round_count: result.roundCount, online_round_count: 0, offline_round_count: roundResults.length,
        offline_round_results: roundWinners, xp_distributed_at: new Date().toISOString(),
      };
      if (!matchId) {
        const { data: ins, error: insErr } = await sb.from("matches").insert({ match_code: code, year: yr, sequence_no: seq, ...matchFields }).select("id").single();
        if (insErr || !ins) { console.log(`  ! insert failed: ${insErr?.message}`); continue; }
        matchId = ins.id;
      } else {
        await sb.from("matches").update(matchFields).eq("id", matchId);
      }
      await sb.from("match_awards").delete().eq("match_id", matchId);
      await sb.from("match_player_aggregate").delete().eq("match_id", matchId);
      const { error: aggErr } = await sb.from("match_player_aggregate").insert(result.aggregates.map((a) => ({ ...a, match_id: matchId })));
      if (aggErr) { console.log(`  ! aggregate write failed: ${aggErr.message}`); continue; }
      if (result.awards.length) await sb.from("match_awards").insert(result.awards.map((a) => ({ ...a, match_id: matchId, awarded_at: new Date().toISOString() })));
      wrote++;
    }
  }

  console.log(`\nGames processed: ${games.length}${LIVE ? `, written: ${wrote}` : ""}`);
  if (unmatchedGuns.size) console.log(`Unmatched guns (fell back to Unknown Gun damage): ${[...unmatchedGuns].join(", ")}`);
  if (unmatchedPlayers.size) console.log(`Unmatched players (treated as walk-ins): ${unmatchedPlayers.size} -> ${[...unmatchedPlayers].slice(0, 40).join(", ")}${unmatchedPlayers.size > 40 ? " ..." : ""}`);
  if (!LIVE) console.log("\nDRY RUN complete - no writes. Re-run with --live to import.");
}
main().catch((e) => { console.error(e); process.exit(1); });
