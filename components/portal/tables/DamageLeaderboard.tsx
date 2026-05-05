import { fetchPeriodRows } from "@/lib/leaderboards/period-shared";
import { TableErrorState } from "@/components/portal/tables/TableErrorState";
import { DamageLeaderboardTable } from "@/components/portal/tables/DamageLeaderboardTable";

/**
 * DamageLeaderboard — server-side wrapper for the Damage leaderboard.
 *
 * Same fetch-once-then-client-filter pattern as the other period
 * leaderboards.
 */
export async function DamageLeaderboard() {
  const result = await fetchPeriodRows();
  if (!result.ok) {
    return <TableErrorState detail={result.error} />;
  }
  return <DamageLeaderboardTable allRows={result.rows} />;
}
