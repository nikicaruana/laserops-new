import { createClient } from "@/lib/supabase/server";
import { getPeriodRowsFromSupabase } from "@/lib/leaderboards/supabase-period";
import { ScoreLeaderboardTable } from "@/components/portal/tables/ScoreLeaderboardTable";

/**
 * ScoreLeaderboard – server-side wrapper for the Score leaderboard.
 *
 * Reads monthly period rows from Supabase (leaderboard_period_stats);
 * the client filters by Year/Month and aggregates on filter change.
 */
export async function ScoreLeaderboard() {
  const supabase = await createClient();
  const rows = await getPeriodRowsFromSupabase(supabase);
  return <ScoreLeaderboardTable allRows={rows} />;
}
