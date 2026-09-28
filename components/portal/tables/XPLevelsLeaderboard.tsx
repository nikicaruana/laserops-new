import { createClient } from "@/lib/supabase/server";
import { getXpLevelsFromSupabase } from "@/lib/leaderboards/supabase-xp-levels";
import { XPLevelsLeaderboardTable } from "@/components/portal/tables/XPLevelsLeaderboardTable";

/**
 * XPLevelsLeaderboard – server-side wrapper.
 *
 * Reads the pre-aggregated per-account XP/level rollup from Supabase
 * (player_stats_lifetime + rank_levels for the rank badge) and delegates
 * to the client-side table which owns sort state and interactivity.
 */
export async function XPLevelsLeaderboard() {
  const supabase = await createClient();
  const rows = await getXpLevelsFromSupabase(supabase);
  return <XPLevelsLeaderboardTable rows={rows} />;
}
