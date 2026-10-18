/* eslint-disable */
/**
 * scripts/validate-reingest.ts  (READ-ONLY - writes nothing)
 * --------------------------------------------------------------------
 * Re-runs a backlog online game through the REAL commit engine (computeMatchCommit)
 * with the CURRENT code + CURRENT admin config, and diffs the result against the
 * live match_player_aggregate. It is the pre-write gate for the re-ingestion:
 *
 *   - RAW stats (frags/deaths/hits/shots/captures/hold/damage) must reproduce the
 *     live DB EXACTLY. Any drift is UNEXPECTED (red flag -> do not write).
 *   - streaks / score / xp MAY differ - those are the intended corrections made
 *     since launch (revenge/redemption, hold-cap, shadow). Shown as EXPECTED.
 *
 * Guns come from the live DB aggregate (gun_used per player), so no .lwa needed for
 * pure-online games. Reads round JSONs from <dir>/jsons (user-supplied).
 *
 *   npx tsx scripts/validate-reingest.ts <code 27|28|29|30|31|32> <dir>
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { computeMatchCommit } from "../lib/ingestion/commit";
import { getScoringConfig } from "../lib/scoring/config";
import { parseXpConfig } from "../lib/scoring/xp";
import { parseLwa } from "../lib/ingestion/lwa";
import { GAMES, norm, hbNum } from "./online-backlog-config";

const CODE = process.argv[2];
const DIR = process.argv[3];

function env() {
  const e: Record<string, string> = {};
  for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) e[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
  return e;
}
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`;

async function main() {
  const cfg = GAMES[CODE];
  if (!cfg) { console.error(`No config for game ${CODE}. Use one of ${Object.keys(GAMES).join(", ")}`); process.exit(1); }
  if (!DIR || !existsSync(`${DIR}/jsons`)) { console.error(`Pass a data dir containing a jsons/ folder. Got: ${DIR}`); process.exit(1); }
  const matchCode = `LO-2026-${CODE}`;
  const e = env();
  const svc = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const anon = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

  // Config (admin-locked), read like the publish route does.
  const scoring = await getScoringConfig(svc as any);
  const { data: xpRows } = await svc.from("xp_config").select("key, value");
  const xpCfg = parseXpConfig((xpRows ?? []) as any);
  const { data: accs } = await anon.from("accolade_definitions").select("id, name, xp").eq("scope", "match");
  if (!accs || accs.length === 0) { console.error("accolade_definitions empty (anon read) - aborting."); process.exit(1); }
  const accoladeByKey = new Map((accs ?? []).map((a: any) => [norm(a.name), { id: a.id as string, xp: (a.xp as number) ?? 0 }]));
  const { data: streakDefs } = await anon.from("streak_definitions").select("streak_key, name, points").eq("is_active", true);
  const streakConfig = Object.fromEntries((streakDefs ?? []).map((sd: any) => [sd.streak_key, { name: sd.name, points: Number(sd.points) || 0 }]));
  const { data: accts } = await svc.from("accounts").select("id, ops_tag");
  const byOps = new Map<string, string>();
  for (const a of (accts ?? []) as any[]) if (a.ops_tag) byOps.set(norm(a.ops_tag), a.id);

  // Live aggregate = the reproduction target + the gun source.
  const { data: m } = await svc.from("matches").select("id").eq("match_code", matchCode).maybeSingle();
  if (!m) { console.error(`${matchCode} not found`); process.exit(1); }
  const { data: live } = await svc.from("match_player_aggregate")
    .select("nickname, account_id, gun_used, frags, deaths, hits, shots, captures, hold_seconds, damage, score, streaks, team_colour")
    .eq("match_id", m.id);
  const liveByNick = new Map<string, any>((live ?? []).map((a: any) => [norm(a.nickname), a]));
  const gunByOps: Record<string, string> = {};
  for (const a of (live ?? []) as any[]) if (a.nickname && a.gun_used) gunByOps[a.nickname] = a.gun_used;

  // Identity resolver (mirrors publish/resolveRoster output, sourced from GAMES + live DB).
  const opsSet = new Set(Object.values(cfg.opsByHead).map(norm));
  const identity = (key: string) => {
    const n = hbNum(key) ?? (/^\d+$/.test(key) ? Number(key) : null);
    let ops: string | undefined;
    if (n != null && cfg.opsByHead[n]) ops = cfg.opsByHead[n];
    else if (opsSet.has(norm(key))) ops = key;
    // also resolve a swapped-in person given by ops-tag
    if (!ops && [...liveByNick.keys()].includes(norm(key))) ops = key;
    if (!ops) return { nickname: n != null ? `Head ${n}` : key, accountId: null as string | null, gun: null as string | null };
    return { nickname: ops, accountId: byOps.get(norm(ops)) ?? null, gun: gunByOps[ops] ?? null };
  };

  // Build rawRounds (+ per-round countsAsRound + identityOverrides from swaps).
  const swapsByRound: Record<number, Record<number, string>> = {};
  for (const s of cfg.identitySwaps ?? []) { (swapsByRound[s.round] ??= {})[s.headband] = identity(s.person).nickname || s.person; }
  let rawRounds: { raw: string; winnerOverride: string | null; countsAsRound: boolean; identityOverrides?: Record<number, string>; resolutions?: any }[];
  let fileOf: string[];
  if (cfg.onlineFiles) {
    fileOf = cfg.onlineFiles.map((o) => o.file);
    rawRounds = cfg.onlineFiles.map((o, i) => ({ raw: readFileSync(`${DIR}/jsons/${o.file}`, "utf8"), winnerOverride: o.win, countsAsRound: true, identityOverrides: swapsByRound[i] }));
  } else {
    const jsonFiles = readdirSync(`${DIR}/jsons`).filter((f) => f.toLowerCase().endsWith(".json")).sort();
    const meta = cfg.roundMeta ?? jsonFiles.map(() => ({ win: null as string | null, counts: true }));
    if (meta.length !== jsonFiles.length) { console.error(`config has ${meta.length} rounds but ${jsonFiles.length} JSON files`); process.exit(1); }
    fileOf = jsonFiles;
    rawRounds = jsonFiles.map((f, i) => ({ raw: readFileSync(`${DIR}/jsons/${f}`, "utf8"), winnerOverride: meta[i].win, countsAsRound: meta[i].counts, identityOverrides: swapsByRound[i] }));
  }
  // Apply any admin capture-ambiguity resolutions already staged in the DB (so a
  // post-publish re-validation accounts for them). Pre-publish there are none.
  const { data: dbRounds } = await svc.from("match_ingest_rounds").select("filename, resolutions").eq("match_id", m.id);
  const resByFile = new Map((dbRounds ?? []).map((r: any) => [r.filename, r.resolutions ?? {}]));
  if (resByFile.size) rawRounds.forEach((r, i) => { r.resolutions = resByFile.get(fileOf[i]) ?? {}; });

  // Hybrid offline injection (LWA), if present on disk.
  let offlineInj: any = { statsByHeadband: {}, roundWinners: [], opsTagByHeadband: cfg.opsByHead, excludeHeadbands: cfg.excludeHeadbands };
  if (cfg.offline) {
    const lwaPath = `${DIR}/lwas/${cfg.offline.lwaFile}`;
    if (!existsSync(lwaPath)) { console.error(`HYBRID game needs offline LWA at ${lwaPath} (missing) - supply it or validate online-only is impossible.`); process.exit(1); }
    const { data: gd } = await svc.rpc("all_gun_damage_at", { p_at: cfg.date });
    const dmgMap = new Map(((gd ?? []) as any[]).map((x) => [norm(x.name), Number(x.damage) || 0]));
    const unknownDmg = dmgMap.get(norm("Unknown Gun")) ?? 0;
    const gunDamage = (ops: string) => { const g = gunByOps[ops]; const d = g ? dmgMap.get(norm(g)) : undefined; return d ?? unknownDmg; };
    const offLwa: any = parseLwa(readFileSync(lwaPath, "utf8"));
    for (const t of offLwa.Teams ?? []) for (const p of t.Players ?? []) {
      const hb = hbNum(String(p.NickName ?? p.Name ?? "")); if (hb == null) continue;
      const ops = cfg.opsByHead[hb] ?? `Head ${hb}`;
      const hits = +p.HitsCount || 0;
      offlineInj.statsByHeadband[hb] = { frags: +p.FragsCount || 0, deaths: +p.DeathsCount || 0, hits, shots: +p.ShotsCount || 0, damage: hits * gunDamage(ops), wounds: +p.WoundsCount || 0, team: String(t.Color) };
    }
    offlineInj.roundWinners = cfg.offline.winners;
  }

  const result = computeMatchCommit(rawRounds as any, accoladeByKey, identity, xpCfg, false, streakConfig, scoring, cfg.offline ? offlineInj : undefined, cfg.excludeHeadbands);

  // ---- Diff vs live DB ----
  const STAT = ["frags", "deaths", "hits", "shots", "captures", "hold_seconds", "damage"] as const;
  const streakTot = (s: any[] | null | undefined) => (s ?? []).reduce((n: number, x: any) => n + (Number(x.count) || 0), 0);
  const streakMap = (s: any[] | null | undefined) => { const m: Record<string, number> = {}; for (const x of s ?? []) m[x.key] = (m[x.key] ?? 0) + (Number(x.count) || 0); return m; };
  const streakKeyDiff = (oldS: any, newS: any) => {
    const o = streakMap(oldS), n = streakMap(newS);
    return [...new Set([...Object.keys(o), ...Object.keys(n)])].sort()
      .filter((k) => (o[k] ?? 0) !== (n[k] ?? 0)).map((k) => `${k} ${o[k] ?? 0}->${n[k] ?? 0}`).join(", ");
  };
  let unexpected = 0, expected = 0, missing = 0;
  console.log(`\n== ${matchCode} :: recompute (current code) vs live DB ==`);
  console.log(`rounds=${result.roundCount} winner=${result.winnerColour ?? "-"} players=${result.aggregates.length} (live ${live?.length ?? 0})\n`);
  const seen = new Set<string>();
  for (const a of result.aggregates) {
    const key = norm(a.nickname); seen.add(key);
    const L = liveByNick.get(key);
    if (!L) { console.log(`  NEW (not in live): ${a.nickname} score=${a.score}  <-- investigate`); missing++; continue; }
    const drift = STAT.filter((f) => Math.round((a as any)[f]) !== Math.round(Number(L[f])));
    const sNew = streakTot(a.streaks), sOld = streakTot(L.streaks);
    const scoreD = a.score - Number(L.score);
    if (drift.length) {
      unexpected++;
      console.log(`  !! STAT DRIFT ${a.nickname}: ${drift.map((f) => `${f} ${Math.round(Number(L[f]))}->${Math.round((a as any)[f])}`).join(", ")}  score ${L.score}->${a.score}`);
    } else if (sNew !== sOld || scoreD !== 0) {
      expected++;
      const kd = streakKeyDiff(L.streaks, a.streaks);
      console.log(`  ~ ${a.nickname}: score ${L.score}->${a.score} (${scoreD >= 0 ? "+" : ""}${scoreD})${kd ? `  [${kd}]` : ""}`);
    }
  }
  for (const [k, L] of liveByNick) if (!seen.has(k)) { console.log(`  DROPPED (in live, not recomputed): ${L.nickname}  <-- investigate`); missing++; }
  console.log(`\nSummary: ${unexpected} stat-drift (MUST be 0 to write), ${expected} streak/score corrections (expected), ${missing} roster mismatches.`);
  if (unexpected || missing) console.log("RESULT: NOT SAFE to write as-is - investigate the flagged players.");
  else console.log("RESULT: raw stats reproduce the live DB exactly; only the intended corrections differ. Safe to write after review.");
}
main().catch((e) => { console.error(e); process.exit(1); });
