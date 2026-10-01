/* eslint-disable */
/**
 * scripts/recompute-all.ts
 * --------------------------------------------------------------------
 * Step D: full launch recompute. Replays XP / level / Elo across every scored
 * match in chronological order (recomputeProgression with no fromMatchId), then
 * rolls up careers + rebuilds the read-models (lifetime stats, leaderboards,
 * ratings, season challenge standings - completed seasons stay frozen).
 * Idempotent: recomputes from the stored per-match scores each run.
 *
 *   npx tsx scripts/recompute-all.ts
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { recomputeProgression } from "../lib/ingestion/progression";

function env() {
  const e: Record<string, string> = {};
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) e[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
  return e;
}

async function main() {
  const e = env();
  const svc = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const anon = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

  console.log("Replaying XP / level / Elo across all matches...");
  const stats = await recomputeProgression(svc);
  console.log(`recomputeProgression: ${JSON.stringify(stats)}`);

  console.log("Rolling up careers + rebuilding read-models...");
  const { error: rErr } = await svc.rpc("rollup_match_careers");
  if (rErr) { console.log("rollup_match_careers ERROR:", rErr.message); process.exit(1); }
  console.log("rollup_match_careers: ok");

  // Sanity: top of the lifetime board.
  const { data: top, error: tErr } = await anon
    .from("player_stats_lifetime")
    .select("nickname, games, total_xp, current_level, current_elo, win_rate")
    .order("total_xp", { ascending: false })
    .limit(10);
  if (tErr) { console.log("lifetime read:", tErr.message); return; }
  console.log("\nTop 10 by total XP:");
  for (const p of top ?? []) console.log(`  ${String(p.nickname).padEnd(18)} L${p.current_level}  xp=${Number(p.total_xp).toLocaleString()}  elo=${p.current_elo}  games=${p.games}  wr=${p.win_rate}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
