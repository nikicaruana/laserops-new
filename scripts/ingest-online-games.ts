/* eslint-disable */
/**
 * scripts/ingest-online-games.ts
 * --------------------------------------------------------------------
 * Ingest the ONLINE (JSON) backlog games into the DB, scored on the LOCKED admin
 * config (not each game's historical beta-report config). Reuses the per-game
 * roster/round config distilled from the build-live-report-* scripts. Writes
 * matches + match_player_aggregate via computeMatchCommit (the publish engine).
 * Does NOT recompute XP/Elo (step D). Guns are derived from each game's LWAs.
 *
 *   npx tsx scripts/ingest-online-games.ts [--game=30] [--live]
 */
import { readFileSync, readdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parseLwa } from "../lib/ingestion/lwa";
import { computeMatchCommit } from "../lib/ingestion/commit";
import { getScoringConfig } from "../lib/scoring/config";
import { parseXpConfig } from "../lib/scoring/xp";

const LIVE = process.argv.includes("--live");
const ONE = (process.argv.find((a) => a.startsWith("--game=")) || "").split("=")[1];
const INGEST_ROOT =
  "C:/Users/nikic/AppData/Local/Temp/claude/C--Users-nikic-Documents-Laseropsmalta-com-laserops-new--claude-worktrees-beautiful-bouman-66c3b3/f0f41fbf-4edc-4679-b4aa-7e0e88372652/scratchpad/ingest";

const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const hbNum = (n: string) => { const m = /head\s*0*(\d+)/i.exec(n || ""); return m ? Number(m[1]) : null; };

// LWA weapon Type -> friendly gun name (matches the guns table).
const TYPE_TO_GUN: Record<string, string> = {
  Ranger: "AR-15 Ranger", Predator: "AK-25 Predator", MachineGunWo: "MG25 Berserk",
  Phoenix: "MP9LT Phoenix", SniperLight: "SR-21 Ghost", SniperMedium: "MR-512 Sniper", Shotgun: "M4 Gastat",
};

type RoundMeta = { win: string | null; counts: boolean };
type GameCfg = {
  date: string;                         // played_on (ISO)
  opsByHead: Record<number, string>;    // headband -> ops tag (also merges switches)
  roundMeta?: RoundMeta[];              // per JSON (file-sorted); default = all derived + counted
  gunOverride?: Record<string, string>; // ops -> gun (when the LWA Type is ambiguous)
  onlineFiles?: { file: string; win: string | null }[]; // explicit online rounds (hybrid / when not all JSONs are real)
  offline?: { lwaFile: string; winners: (string | null)[] }; // HYBRID: the offline rounds' LWA + winners
};

const GAMES: Record<string, GameCfg> = {
  "27": {
    date: "2026-09-05",
    opsByHead: { 1: "Snaaaaaaake", 2: "Buwdha", 4: "Sina", 6: "Jens", 37: "BSoD", 39: "Jinnies", 40: "TheHolySpirit", 41: "Glenn", 42: "Tompa", 45: "aximus" },
  },
  "30": {
    date: "2026-09-19",
    opsByHead: { 1: "Uros", 4: "Agius89", 5: "Kuba", 6: "Kyle", 7: "Buwdha", 9: "OrteGaTD", 21: "Hasapardi", 23: "Jens", 26: "Sina", 27: "Glenn", 32: "ChrisKyle", 37: "_Stivala_", 39: "Kyle", 40: "Tompa", 41: "POL", 42: "Maltese Predator", 43: "Waldemar", 44: "M1hoTD", 53: "Migz", 58: "TheHolySpirit" },
    roundMeta: [ { win: "Yellow", counts: true }, { win: "Blue", counts: true }, { win: "Yellow", counts: true }, { win: "Blue", counts: true }, { win: "Yellow", counts: true } ],
  },
  "31": {
    date: "2026-09-21",
    opsByHead: { 4: "Tompa", 21: "Hasapardi", 25: "Farru", 26: "Kini", 27: "Maltese Predator", 51: "ChrisKyle", 7: "Mustafa", 32: "Glenn", 38: "Snaaaaaaake", 39: "PourHoneyOnMyBun", 42: "TheHolySpirit", 43: "Buwdha", 47: "Dre" },
    roundMeta: [ { win: "Yellow", counts: true }, { win: null, counts: false }, { win: "Blue", counts: true }, { win: "Blue", counts: true }, { win: "Yellow", counts: true }, { win: "Yellow", counts: true } ],
    gunOverride: { Glenn: "MG21 Berserk" },
  },
  "32": {
    date: "2026-09-26",
    opsByHead: { 1: "Seb PT", 4: "Chuck Joey", 5: "JRilez", 7: "Buwdha", 9: "Lupita", 12: "Boulton", 13: "Alejkilmister", 15: "Spooble", 20: "Snaaaaaaake", 21: "Umut", 25: "Alejkilmister", 26: "aximus", 27: "Stev-o", 32: "Glenn", 37: "PT", 38: "Tompa", 39: "Maltese Predator", 40: "Piet", 41: "Dogukan", 42: "ChrisKyle", 43: "Huntress", 44: "LuXyz", 45: "Mustafa", 46: "Uros", 47: "Jens", 48: "M1hoTD", 49: "Hasapardi", 50: "Anna", 51: "Umut", 52: "TFG", 53: "Didi", 54: "Glenn", 55: "Dina", 56: "Dobi", 57: "Cinti", 59: "TheHolySpirit", 60: "Amy", 61: "LuXyz", 62: "OrteGaTD" },
    onlineFiles: [
      { file: "RealtimeStatistics_20260926_080541.json", win: "Blue" },
      { file: "RealtimeStatistics_20260926_083159.json", win: "Yellow" },
      { file: "RealtimeStatistics_20260926_090022.json", win: "Blue" },
    ],
    offline: { lwaFile: "AlphaTag.Statistic_2026.09.26_13.28.08_OfflineRounds.lwa", winners: ["Blue", "Yellow"] },
  },
};

function env() {
  const e: Record<string, string> = {};
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) e[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
  return e;
}

/** Dominant weapon per headband from a game's LWA exports -> ops -> friendly gun. */
function gunsByOps(dir: string, opsByHead: Record<number, string>, override?: Record<string, string>): Record<string, string> {
  const typeByHb: Record<number, Record<string, number>> = {};
  let files: string[] = [];
  try { files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".lwa")); } catch { files = []; }
  for (const f of files) {
    let g: any; try { g = parseLwa(readFileSync(`${dir}/${f}`, "utf8")); } catch { continue; }
    for (const t of g.Teams ?? []) for (const p of t.Players ?? []) {
      const hb = hbNum(String(p.NickName ?? p.Name ?? "")); if (hb == null) continue;
      for (const w of p.Weapons ?? []) { const ty = String(w?.Type ?? ""); if (!ty) continue; (typeByHb[hb] ??= {})[ty] = (typeByHb[hb][ty] ?? 0) + 1; }
    }
  }
  const out: Record<string, string> = {};
  for (const [hbStr, ops] of Object.entries(opsByHead)) {
    const hb = Number(hbStr); const t = typeByHb[hb]; if (!t || out[ops]) continue;
    const top = Object.entries(t).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (top) out[ops] = TYPE_TO_GUN[top] ?? top;
  }
  if (override) for (const [ops, gun] of Object.entries(override)) out[ops] = gun;
  return out;
}

async function main() {
  const e = env();
  const svc = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const anon = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

  console.log(`Mode: ${LIVE ? "LIVE (writing)" : "DRY RUN"}${ONE ? `  (game ${ONE} only)` : ""}`);

  const scoring = await getScoringConfig(svc);
  const { data: xpRows } = await svc.from("xp_config").select("key, value");
  const xpCfg = parseXpConfig((xpRows ?? []) as any);
  const { data: accts } = await svc.from("accounts").select("id, ops_tag");
  const byOps = new Map<string, string>();
  for (const a of (accts ?? []) as any[]) if (a.ops_tag) byOps.set(norm(a.ops_tag), a.id);
  const { data: accs } = await anon.from("accolade_definitions").select("id, name, xp").eq("scope", "match");
  const accoladeByKey = new Map((accs ?? []).map((a: any) => [norm(a.name), { id: a.id as string, xp: (a.xp as number) ?? 0 }]));
  const { data: streakDefs } = await anon.from("streak_definitions").select("streak_key, name, points").eq("is_active", true);
  const streakConfig = Object.fromEntries((streakDefs ?? []).map((sd: any) => [sd.streak_key, { name: sd.name, points: Number(sd.points) || 0 }]));

  const codes = ONE ? [ONE] : Object.keys(GAMES);
  for (const code of codes) {
    const cfg = GAMES[code]; if (!cfg) { console.log(`No config for ${code}`); continue; }
    const matchCode = `LO-2026-${code}`;
    const dir = `${INGEST_ROOT}/${matchCode}`;
    const gunByOps = gunsByOps(`${dir}/lwas`, cfg.opsByHead, cfg.gunOverride);
    // identity() is called with a headband number ("6"), a raw label ("Head 06"),
    // OR an already-resolved ops tag ("Jens") - commit.ts passes p.name. Resolve all.
    const opsSet = new Set(Object.values(cfg.opsByHead).map(norm));
    const identity = (key: string) => {
      const n = hbNum(key) ?? (/^\d+$/.test(key) ? Number(key) : null);
      let ops: string | undefined;
      if (n != null && cfg.opsByHead[n]) ops = cfg.opsByHead[n];
      else if (opsSet.has(norm(key))) ops = key;
      if (!ops) return { nickname: n != null ? `Head ${n}` : key, accountId: null as string | null, gun: null as string | null };
      return { nickname: ops, accountId: byOps.get(norm(ops)) ?? null, gun: gunByOps[ops] ?? null };
    };

    // Online rounds: an explicit list (hybrid / when not all JSONs are real rounds),
    // else all sorted JSONs with roundMeta.
    let rawRounds: { raw: string; winnerOverride: string | null; countsAsRound: boolean }[];
    if (cfg.onlineFiles) {
      rawRounds = cfg.onlineFiles.map((o) => ({ raw: readFileSync(`${dir}/jsons/${o.file}`, "utf8"), winnerOverride: o.win, countsAsRound: true }));
    } else {
      const jsonFiles = readdirSync(`${dir}/jsons`).filter((f) => f.toLowerCase().endsWith(".json")).sort();
      const meta = cfg.roundMeta ?? jsonFiles.map(() => ({ win: null as string | null, counts: true }));
      if (meta.length !== jsonFiles.length) { console.log(`${matchCode}: config has ${meta.length} rounds but ${jsonFiles.length} JSON files - skipping`); continue; }
      rawRounds = jsonFiles.map((f, i) => ({ raw: readFileSync(`${dir}/jsons/${f}`, "utf8"), winnerOverride: meta[i].win, countsAsRound: meta[i].counts }));
    }

    // opsTagByHeadband is passed (via the offline hook) so headband renames +
    // switch-merges apply exactly like the beta report. For HYBRID games the hook
    // also carries the offline rounds' kill stats + winners.
    const offlineInj: { statsByHeadband: Record<number, any>; roundWinners: (string | null)[]; opsTagByHeadband: Record<number, string> } =
      { statsByHeadband: {}, roundWinners: [], opsTagByHeadband: cfg.opsByHead };
    if (cfg.offline) {
      const { data: gd } = await svc.rpc("all_gun_damage_at", { p_at: cfg.date });
      const dmgMap = new Map(((gd ?? []) as any[]).map((x) => [norm(x.name), Number(x.damage) || 0]));
      const unknownDmg = dmgMap.get(norm("Unknown Gun")) ?? 0;
      const gunDamage = (ops: string) => { const g = gunByOps[ops]; const d = g ? dmgMap.get(norm(g)) : undefined; return d ?? unknownDmg; };
      const offLwa: any = parseLwa(readFileSync(`${dir}/lwas/${cfg.offline.lwaFile}`, "utf8"));
      for (const t of offLwa.Teams ?? []) for (const p of t.Players ?? []) {
        const hb = hbNum(String(p.NickName ?? p.Name ?? "")); if (hb == null) continue;
        const ops = cfg.opsByHead[hb] ?? `Head ${hb}`;
        const hits = +p.HitsCount || 0;
        offlineInj.statsByHeadband[hb] = { frags: +p.FragsCount || 0, deaths: +p.DeathsCount || 0, hits, shots: +p.ShotsCount || 0, damage: hits * gunDamage(ops), wounds: +p.WoundsCount || 0, team: String(t.Color) };
      }
      offlineInj.roundWinners = cfg.offline.winners;
    }
    const result = computeMatchCommit(rawRounds, accoladeByKey, identity, xpCfg, false, streakConfig, scoring, offlineInj);

    const top = [...result.aggregates].sort((a, b) => b.score - a.score).slice(0, 5).map((a) => `${a.nickname} ${a.score}`).join(", ");
    console.log(`${matchCode}  ${cfg.date}  players=${result.aggregates.length}  rounds=${result.roundCount}  winner=${result.winnerColour ?? "-"}  top: ${top}`);

    if (LIVE) {
      const { data: existing } = await svc.from("matches").select("id").eq("match_code", matchCode).maybeSingle();
      let matchId = existing?.id as string | undefined;
      const yr = Number(matchCode.slice(3, 7));
      const seq = Number(matchCode.slice(8));
      const offCount = cfg.offline ? cfg.offline.winners.length : 0;
      const fields = {
        status: "completed", scoring_mode: cfg.offline ? "offline" : "online", played_on: cfg.date,
        winning_team_colour: result.winnerColour, net_result_summary: result.netResultSummary,
        round_count: result.roundCount, online_round_count: result.roundCount - offCount, offline_round_count: offCount,
        offline_round_results: cfg.offline ? cfg.offline.winners : null,
        xp_distributed_at: new Date().toISOString(),
      };
      if (!matchId) {
        const { data: ins, error: insErr } = await svc.from("matches").insert({ match_code: matchCode, year: yr, sequence_no: seq, ...fields }).select("id").single();
        if (insErr || !ins) { console.log(`  ! insert failed: ${insErr?.message}`); continue; }
        matchId = ins.id;
      } else {
        await svc.from("matches").update(fields).eq("id", matchId);
      }
      await svc.from("match_awards").delete().eq("match_id", matchId);
      await svc.from("match_player_aggregate").delete().eq("match_id", matchId);
      const { error: aggErr } = await svc.from("match_player_aggregate").insert(result.aggregates.map((a) => ({ ...a, match_id: matchId })));
      if (aggErr) { console.log(`  ! aggregate write failed: ${aggErr.message}`); continue; }
      if (result.awards.length) await svc.from("match_awards").insert(result.awards.map((a) => ({ ...a, match_id: matchId, awarded_at: new Date().toISOString() })));
      console.log(`  written (${result.aggregates.length} players, ${result.awards.length} awards)`);
    }
  }
  if (!LIVE) console.log("\nDRY RUN - no writes. Add --live to ingest.");
}
main().catch((e) => { console.error(e); process.exit(1); });
