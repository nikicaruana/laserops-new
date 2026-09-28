import { createClient } from "@/lib/supabase/server";
import { getPeriodRowsFromSupabase } from "@/lib/leaderboards/supabase-period";
import { DamageLeaderboardTable } from "@/components/portal/tables/DamageLeaderboardTable";

/**
 * DamageLeaderboard – server-side wrapper for the Damage leaderboard.
 *
 * Reads monthly period rows from Supabase (leaderboard_period_stats);
 * the client filters by Year/Month and aggregates on filter change.
 */
export async function DamageLeaderboard() {
  const supabase = await createClient();
  const rows = await getPeriodRowsFromSupabase(supabase);
  return <DamageLeaderboardTable allRows={rows} />;
}
