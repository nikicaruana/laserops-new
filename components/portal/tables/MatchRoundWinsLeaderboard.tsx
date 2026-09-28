import { createClient } from "@/lib/supabase/server";
import { getPeriodRowsFromSupabase } from "@/lib/leaderboards/supabase-period";
import { MatchRoundWinsLeaderboardTable } from "@/components/portal/tables/MatchRoundWinsLeaderboardTable";

/**
 * MatchRoundWinsLeaderboard – server-side wrapper.
 *
 * Reads monthly period rows from Supabase (leaderboard_period_stats) and
 * hands them to the client component, which owns:
 *   - The Year/Month filter UI (URL-driven)
 *   - Filtering, aggregating, sorting, sort-on-header-click
 *
 * Filtering/aggregation stays client-side so filter changes are instant
 * (no refetch). The monthly rows are summed per the selected window, which
 * reproduces every filter combination (all-time / year / month).
 */
export async function MatchRoundWinsLeaderboard() {
  const supabase = await createClient();
  const rows = await getPeriodRowsFromSupabase(supabase);
  return <MatchRoundWinsLeaderboardTable allRows={rows} />;
}
