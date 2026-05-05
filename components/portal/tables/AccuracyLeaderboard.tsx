import { fetchPeriodRows } from "@/lib/leaderboards/period-shared";
import { TableErrorState } from "@/components/portal/tables/TableErrorState";
import { AccuracyLeaderboardTable } from "@/components/portal/tables/AccuracyLeaderboardTable";

/**
 * AccuracyLeaderboard — server-side wrapper for the Accuracy
 * leaderboard.
 */
export async function AccuracyLeaderboard() {
  const result = await fetchPeriodRows();
  if (!result.ok) {
    return <TableErrorState detail={result.error} />;
  }
  return <AccuracyLeaderboardTable allRows={result.rows} />;
}
