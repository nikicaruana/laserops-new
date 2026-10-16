/* eslint-disable */
/**
 * scripts/backfill-revenge-redemption.ts
 * --------------------------------------------------------------------
 * One-off backfill after the Revenge/Redemption fix (detectStreaks now emits
 * both tier-1 streaks). Re-commits every SCORED match that has online (JSON)
 * rounds, re-running the exact publish-time scoring (computeMatchCommit), so the
 * two streaks are detected and their points flow into score / match_rating / XP.
 *
 * Mirrors app/api/matches/[id]/publish/route.ts's compute + write block, but:
 *   - does NOT emit any notifications (publish's emits are 14-day recency-guarded
 *     anyway, but we skip them outright),
 *   - does NOT touch the matches row (winner/round_count/xp_distributed_at are
 *     unaffected by streak points — match winner is by rounds won), and
 *   - does NOT run derive_match_squad_colours (avoids any ladder re-trigger).
 *
 * Pure-offline matches (no JSON rounds) are skipped — offline scoring has no
 * streaks, so nothing would change.
 *
 * Dry run (default): reports, per match, which players newly gain Revenge /
 * Redemption and their old -> new score. Writes nothing.
 *   npx tsx scripts/backfill-revenge-redemption.ts
 *
 * Apply: rewrites match_player_aggregate + match_awards per affected match, then
 * replays XP/level/Elo across ALL matches (recomputeProgression) + rollup.
 *   npx tsx scripts/backfill-revenge-redemption.ts --write
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { type RoundResolutions } from "../lib/ingestion/resolutions";
import { computeMatchCommit } from "../lib/ingestion/commit";
import { getScoringConfig } from "../lib/scoring/config";
import { lwaMatchPlayers, isLwa } from "../lib/ingestion/lwa";
import { parseXpConfig } from "../lib/scoring/xp";
import { resolveRoster } from "../lib/ingestion/roster";
import { recomputeProgression } from "../lib/ingestion/progression";

const WRITE = process.argv.includes("--write");
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function env() {
  const e: Record<string, string> = {};
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) e[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return e;
}

type AggStreak = { key: string; count: number; points: number };
const streakCount = (streaks: AggStreak[] | null | undefined, key: string) =>
  (streaks ?? []).filter((s) => s.key === key).reduce((n, s) => n + (Number(s.count) || 0), 0);

async function main() {
  const e = env();
  const svc = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  // Config tables are readable by anon (public surfaces read them) but NOT by
  // service_role (grant gap — "permission denied"). The publish route reads
  // config with the admin USER client and writes with service_role; mirror that
  // by reading all config via anon. svc is used only for writes.
  const anon = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

  // Shared config (same sources as the publish route). HARD-FAIL on any error or
  // empty result — a silently-empty config map is exactly what wiped accolades.
  const { data: accs, error: accErr } = await anon.from("accolade_definitions").select("id, name, xp").eq("scope", "match");
  if (accErr) { console.error("accolade_definitions read FAILED:", accErr.message); process.exit(1); }
  if (!accs || accs.length === 0) { console.error("accolade_definitions returned 0 rows — aborting (would wipe accolades)."); process.exit(1); }
  const accoladeByKey = new Map((accs ?? []).map((a: any) => [norm(a.name), { id: a.id as string, xp: (a.xp as number) ?? 0 }]));
  const { data: xpCfg, error: xpErr } = await anon.from("xp_config").select("key, value");
  if (xpErr) { console.error("xp_config read FAILED:", xpErr.message); process.exit(1); }
  if (!xpCfg || xpCfg.length === 0) { console.error("xp_config returned 0 rows — aborting."); process.exit(1); }
  const cfg = parseXpConfig((xpCfg ?? []) as { key: string; value: number | null }[]);
  const { data: streakDefs, error: sdErr } = await anon.from("streak_definitions").select("streak_key, name, points").eq("is_active", true);
  if (sdErr) { console.error("streak_definitions read FAILED:", sdErr.message); process.exit(1); }
  if (!streakDefs || streakDefs.length === 0) { console.error("streak_definitions returned 0 rows — aborting."); process.exit(1); }
  const streakConfig = Object.fromEntries((streakDefs ?? []).map((sd: any) => [sd.streak_key as string, { name: sd.name as string, points: Number(sd.points) || 0 }]));
  if (!streakConfig["revenge"] || !streakConfig["redemption"]) { console.error("revenge/redemption not in active streak_definitions — aborting."); process.exit(1); }
  const scoringRuntime = await getScoringConfig(anon as any);
  console.log(`config loaded: ${accs.length} match accolades, ${xpCfg.length} xp keys, ${streakDefs.length} active streaks\n`);

  // Every scored match, oldest first.
  const { data: matches, error: mErr } = await svc
    .from("matches")
    .select("id, title, match_code, played_on, scheduled_at, is_double_xp, offline_round_results, scoring_mode")
    .not("xp_distributed_at", "is", null)
    .order("played_on", { ascending: true });
  if (mErr) { console.error("match list:", mErr.message); process.exit(1); }

  console.log(`${WRITE ? "WRITE" : "DRY RUN"} — ${(matches ?? []).length} scored matches\n`);
  let touched = 0, totalNewRevenge = 0, totalNewRedemption = 0;
  // Census buckets so every scored match is accounted for.
  const census = { noJson: [] as string[], cleanNone: [] as string[], cleanWithStreaks: [] as string[], divergentWithStreaks: [] as string[], divergentNone: [] as string[] };

  for (const m of (matches ?? []) as any[]) {
    const label = m.title || m.match_code || m.id;
    const { data: rows } = await svc.from("match_ingest_rounds").select("raw_file, resolutions, mode, winner_override").eq("match_id", m.id).order("created_at");
    const ingested = (rows ?? []).filter((r: any) => r.raw_file);
    const jsonRows = ingested.filter((r: any) => !isLwa(r.raw_file as string));
    if (jsonRows.length === 0) { census.noJson.push(label); continue; } // pure offline (or no JSON) — no streaks possible

    const identity = await resolveRoster(svc as any, m.id);
    const isDoubleXp = m.is_double_xp === true;
    const isOffline = m.scoring_mode === "offline";
    const playedOn = (m.played_on as string | null) || ((m.scheduled_at as string | null)?.slice(0, 10)) || new Date().toISOString().slice(0, 10);

    let result;
    if (isOffline) {
      // HYBRID: online JSON rounds (full) + offline .lwa kill stats merged in.
      const lwaRows = ingested.filter((r: any) => isLwa(r.raw_file as string));
      const offlineWinners = ((m.offline_round_results ?? []) as (string | null)[]).map((c) => c || null);
      const { data: gd } = await svc.rpc("all_gun_damage_at", { p_at: playedOn });
      const dmgMap = new Map(((gd ?? []) as any[]).map((x) => [String(x.name).toLowerCase().trim(), Number(x.damage) || 0]));
      const unknownDmg = dmgMap.get("unknown gun") ?? 0;
      const gunDamage = (name: string | null | undefined) => (name ? dmgMap.get(name.toLowerCase().trim()) ?? unknownDmg : unknownDmg);
      const statsByHeadband: Record<number, any> = {};
      const opsTagByHeadband: Record<number, string> = {};
      for (const r of lwaRows) {
        let pls: ReturnType<typeof lwaMatchPlayers> = [];
        try { pls = lwaMatchPlayers(r.raw_file as string); } catch { pls = []; }
        for (const pl of pls) {
          const hb = Number(String(pl.headband).match(/\d+/)?.[0]);
          if (!Number.isFinite(hb)) continue;
          const en = identity(String(hb));
          const prev = statsByHeadband[hb];
          statsByHeadband[hb] = {
            frags: (prev?.frags ?? 0) + pl.frags, deaths: (prev?.deaths ?? 0) + pl.deaths,
            hits: (prev?.hits ?? 0) + pl.hits, shots: (prev?.shots ?? 0) + pl.shots,
            damage: (prev?.damage ?? 0) + pl.hits * gunDamage(en.gun), wounds: (prev?.wounds ?? 0) + (pl.wounds ?? 0),
            team: pl.team,
          };
          if (en.accountId) opsTagByHeadband[hb] = en.nickname;
        }
      }
      const onlineRounds = jsonRows.map((r: any) => ({ raw: r.raw_file as string, resolutions: (r.resolutions ?? {}) as RoundResolutions, winnerOverride: (r.winner_override as string | null) ?? null }));
      result = computeMatchCommit(onlineRounds, accoladeByKey, identity, cfg, isDoubleXp, streakConfig, scoringRuntime, { statsByHeadband, roundWinners: offlineWinners, opsTagByHeadband });
    } else {
      // Pure online JSON rounds.
      const rounds = jsonRows.map((r: any) => ({ raw: r.raw_file as string, resolutions: (r.resolutions ?? {}) as RoundResolutions, winnerOverride: (r.winner_override as string | null) ?? null }));
      result = computeMatchCommit(rounds, accoladeByKey, identity, cfg, isDoubleXp, streakConfig, scoringRuntime);
    }

    // Compare new streaks vs currently stored. A match is CLEAN (only the streak
    // fix changed it) iff every player matches by label AND their underlying,
    // non-streak stats (frags/deaths/hits/shots/captures/hold/damage) are byte-
    // identical to what's stored — i.e. re-committing changed nothing but streaks
    // (and the score/XP they feed). Any stat drift or roster mismatch => DIVERGENT
    // (these were scored under bespoke per-match config and must be handled by a
    // proper re-ingest, not this blanket backfill).
    const { data: curAgg } = await svc.from("match_player_aggregate")
      .select("headset_label, streaks, score, frags, deaths, hits, shots, captures, hold_seconds, damage, xp_from_accolades").eq("match_id", m.id);
    const curByLabel = new Map((curAgg ?? []).map((a: any) => [a.headset_label as string, a]));
    // Non-streak invariants that MUST be reproduced identically, or the re-commit
    // is changing more than streaks (xp_from_accolades guards accolade XP, which
    // is NOT in score so a missing-accolade bug would otherwise slip through).
    const STAT_FIELDS = ["frags", "deaths", "hits", "shots", "captures", "hold_seconds", "damage", "xp_from_accolades"] as const;
    const changes: string[] = [];
    const reasons: string[] = [];
    // Stored accolade awards per label — the re-commit must reproduce the exact
    // same set (same accolade_definition_id per player), else accolades would be lost.
    const { data: curAwards } = await svc.from("match_awards").select("headset_label, accolade_definition_id").eq("match_id", m.id);
    const awardSet = (rows: { headset_label: string; accolade_definition_id: string }[]) =>
      new Set(rows.map((r) => `${r.headset_label}|${r.accolade_definition_id}`));
    const curAwardSet = awardSet((curAwards ?? []) as any);
    const newAwardSet = awardSet(result.awards.map((a: any) => ({ headset_label: a.headset_label, accolade_definition_id: a.accolade_definition_id })));
    if (curAwardSet.size !== newAwardSet.size) reasons.push(`award count ${curAwardSet.size} -> ${newAwardSet.size}`);
    for (const k of curAwardSet) if (!newAwardSet.has(k)) reasons.push(`award dropped: ${k}`);
    for (const k of newAwardSet) if (!curAwardSet.has(k)) reasons.push(`award added: ${k}`);
    let newRevAbs = 0, newRedAbs = 0, oldRevAbs = 0, oldRedAbs = 0;
    if (result.aggregates.length !== (curAgg ?? []).length) reasons.push(`player count ${(curAgg ?? []).length} -> ${result.aggregates.length}`);
    for (const a of result.aggregates) {
      const cur = curByLabel.get(a.headset_label);
      if (!cur) { reasons.push(`new/renamed label "${a.headset_label}"`); continue; }
      for (const f of STAT_FIELDS) {
        if (Math.abs(Number((a as any)[f] ?? 0) - Number((cur as any)[f] ?? 0)) > 0.5) reasons.push(`${a.nickname || a.headset_label} ${f} ${cur[f]}->${(a as any)[f]}`);
      }
      const newRev = streakCount(a.streaks as AggStreak[], "revenge");
      const newRed = streakCount(a.streaks as AggStreak[], "redemption");
      const oldRev = streakCount(cur?.streaks, "revenge");
      const oldRed = streakCount(cur?.streaks, "redemption");
      newRevAbs += newRev; newRedAbs += newRed; oldRevAbs += oldRev; oldRedAbs += oldRed;
      if (newRev !== oldRev || newRed !== oldRed) {
        const parts: string[] = [];
        if (newRev !== oldRev) parts.push(`Revenge ${oldRev}->${newRev}`);
        if (newRed !== oldRed) parts.push(`Redemption ${oldRed}->${newRed}`);
        changes.push(`    ${a.nickname || a.headset_label}: ${parts.join(", ")}  (score ${Number(cur?.score ?? 0)} -> ${a.score})`);
      }
    }
    const diverges = reasons.length > 0;
    const hasStreaks = (newRevAbs + newRedAbs) > 0;
    const matchNewRev = newRevAbs, matchNewRed = newRedAbs;
    // Census classification (every online/hybrid match lands in exactly one bucket).
    if (diverges && hasStreaks) census.divergentWithStreaks.push(label);
    else if (diverges) census.divergentNone.push(label);
    else if (hasStreaks) census.cleanWithStreaks.push(label);
    else census.cleanNone.push(label);

    if (changes.length === 0) continue;
    const status = diverges ? "⚠ DIVERGENT — re-scores beyond streaks, SKIPPED" : "✓ clean (streaks only)";
    console.log(`● ${label}  [${m.played_on ?? "?"}]  ${isOffline ? "hybrid" : "online"}  — ${status}`);
    for (const c of changes) console.log(c);
    if (diverges) { console.log(`    why divergent: ${[...new Set(reasons)].slice(0, 6).join("; ")}${reasons.length > 6 ? " …" : ""}`); console.log("    (skipped — handle via a proper re-ingest)\n"); continue; }
    touched++;
    totalNewRevenge += matchNewRev;
    totalNewRedemption += matchNewRed;

    if (WRITE) {
      const now = new Date().toISOString();
      await svc.from("match_awards").delete().eq("match_id", m.id);
      await svc.from("match_player_aggregate").delete().eq("match_id", m.id);
      const { error: aggErr } = await svc.from("match_player_aggregate").insert(result.aggregates.map((a: any) => ({ ...a, match_id: m.id })));
      if (aggErr) { console.error(`  aggregate write failed: ${aggErr.message}`); process.exit(1); }
      if (result.awards.length) {
        const { error: awErr } = await svc.from("match_awards").insert(result.awards.map((a: any) => ({ ...a, match_id: m.id, awarded_at: now })));
        if (awErr) { console.error(`  awards write failed: ${awErr.message}`); process.exit(1); }
      }
      console.log(`  ✓ rewrote ${result.aggregates.length} aggregates, ${result.awards.length} awards`);
    }
  }

  const total = (matches ?? []).length;
  const onlineHybrid = total - census.noJson.length;
  console.log("\n================ CENSUS — every scored match accounted for ================");
  console.log(`Total scored matches: ${total}`);
  console.log(`  • Offline / no JSON rounds (streaks impossible, N/A): ${census.noJson.length}`);
  console.log(`  • Online/hybrid — re-commit CLEAN, no Revenge/Redemption earned: ${census.cleanNone.length}`);
  console.log(`  • Online/hybrid — re-commit CLEAN, HAS streaks (WILL backfill): ${census.cleanWithStreaks.length}`);
  for (const l of census.cleanWithStreaks) console.log(`        ✓ ${l}`);
  console.log(`  • Online/hybrid — DIVERGENT, HAS streaks (skipped, needs re-ingest): ${census.divergentWithStreaks.length}`);
  for (const l of census.divergentWithStreaks) console.log(`        ⚠ ${l}`);
  console.log(`  • Online/hybrid — DIVERGENT, no streaks anyway (skipped, no awards lost): ${census.divergentNone.length}`);
  for (const l of census.divergentNone) console.log(`        · ${l}`);
  console.log(`  (online/hybrid total: ${onlineHybrid})`);
  console.log("===========================================================================");

  console.log(`\n${touched} match(es) with changes — +${totalNewRevenge} Revenge, +${totalNewRedemption} Redemption awards.`);

  if (WRITE && touched > 0) {
    console.log("\nReplaying XP / level / Elo across all matches...");
    const stats = await recomputeProgression(svc as any);
    console.log(`recomputeProgression: ${JSON.stringify(stats)}`);
    const { error: rErr } = await svc.rpc("rollup_match_careers");
    if (rErr) { console.error("rollup_match_careers ERROR:", rErr.message); process.exit(1); }
    console.log("rollup_match_careers: ok");
  } else if (!WRITE) {
    console.log("\n(dry run — nothing written. Re-run with --write to apply.)");
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
