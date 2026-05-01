import { fetchXpLevelsLeaderboard } from "@/lib/leaderboards/xp-levels";
import { TableErrorState } from "@/components/portal/tables/TableErrorState";
import { XPLevelsLeaderboardTable } from "@/components/portal/tables/XPLevelsLeaderboardTable";

/**
 * XPLevelsLeaderboard — server-side wrapper.
 *
 * Fetches the data on the server (cached for 5min by Next.js fetch revalidate)
 * and either renders the error state OR delegates to the client-side table
 * component which owns sort state and interactivity.
 */
export async function XPLevelsLeaderboard() {
  const result = await fetchXpLevelsLeaderboard();
  if (!result.ok) {
    return <TableErrorState detail={result.error} />;
  }
  return <XPLevelsLeaderboardTable rows={result.rows} />;
}
