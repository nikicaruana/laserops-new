import { createClient } from "@/lib/supabase/server";
import { getPeriodRowsFromSupabase } from "@/lib/leaderboards/supabase-period";
import { KillsLeaderboardTable } from "@/components/portal/tables/KillsLeaderboardTable";

/**
 * KillsLeaderboard – server-side wrapper for the Kills leaderboard.
 *
 * Reads monthly period rows from Supabase (leaderboard_period_stats);
 * the client filters by Year/Month and aggregates on filter change.
 */
export async function KillsLeaderboard() {
  const supabase = await createClient();
  const rows = await getPeriodRowsFromSupabase(supabase);
  return <KillsLeaderboardTable allRows={rows} />;
}
