import { createClient } from "@/lib/supabase/server";
import { getPeriodRowsFromSupabase } from "@/lib/leaderboards/supabase-period";
import { AccuracyLeaderboardTable } from "@/components/portal/tables/AccuracyLeaderboardTable";

/**
 * AccuracyLeaderboard – server-side wrapper for the Accuracy leaderboard.
 *
 * Reads monthly period rows from Supabase (leaderboard_period_stats);
 * the client filters by Year/Month and aggregates on filter change.
 */
export async function AccuracyLeaderboard() {
  const supabase = await createClient();
  const rows = await getPeriodRowsFromSupabase(supabase);
  return <AccuracyLeaderboardTable allRows={rows} />;
}
