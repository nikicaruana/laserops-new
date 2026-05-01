import { fetchPeriodRows } from "@/lib/leaderboards/period-shared";
import { TableErrorState } from "@/components/portal/tables/TableErrorState";
import { ScoreLeaderboardTable } from "@/components/portal/tables/ScoreLeaderboardTable";

/**
 * ScoreLeaderboard — server-side wrapper for the Score leaderboard.
 *
 * Same fetch-once-then-client-filter pattern as Match/Round Wins:
 * server fetches all PeriodRows (cached 5min), client filters and
 * aggregates on filter change.
 */
export async function ScoreLeaderboard() {
  const result = await fetchPeriodRows();
  if (!result.ok) {
    return <TableErrorState detail={result.error} />;
  }
  return <ScoreLeaderboardTable allRows={result.rows} />;
}
