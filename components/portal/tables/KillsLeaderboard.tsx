import { fetchPeriodRows } from "@/lib/leaderboards/period-shared";
import { TableErrorState } from "@/components/portal/tables/TableErrorState";
import { KillsLeaderboardTable } from "@/components/portal/tables/KillsLeaderboardTable";

/**
 * KillsLeaderboard — server-side wrapper for the Kills leaderboard.
 *
 * Same fetch-once-then-client-filter pattern as Score and Match/Round
 * Wins: server fetches all PeriodRows (cached 5min); client filters
 * and aggregates on filter change.
 */
export async function KillsLeaderboard() {
  const result = await fetchPeriodRows();
  if (!result.ok) {
    return <TableErrorState detail={result.error} />;
  }
  return <KillsLeaderboardTable allRows={result.rows} />;
}
