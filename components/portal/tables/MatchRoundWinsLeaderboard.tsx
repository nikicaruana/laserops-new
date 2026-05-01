import { fetchPeriodRows } from "@/lib/leaderboards/period-shared";
import { TableErrorState } from "@/components/portal/tables/TableErrorState";
import { MatchRoundWinsLeaderboardTable } from "@/components/portal/tables/MatchRoundWinsLeaderboardTable";

/**
 * MatchRoundWinsLeaderboard — server-side wrapper.
 *
 * Fetches ALL period rows once (cached 5min via Next.js fetch revalidate)
 * and hands them to the client component, which owns:
 *   - The Year/Month filter UI (URL-driven)
 *   - Filtering, aggregating, sorting, sort-on-header-click
 *
 * Why not filter on the server: each filter change would trigger a full
 * page re-render and refetch (still cached, but a network round trip).
 * Filtering on the client gives instant filter changes and keeps the
 * sheet read frequency low. The data volume is small (~1200 rows × 32
 * columns ≈ 60-80KB JSON), so shipping it to the client is fine.
 */
export async function MatchRoundWinsLeaderboard() {
  const result = await fetchPeriodRows();
  if (!result.ok) {
    return <TableErrorState detail={result.error} />;
  }
  return <MatchRoundWinsLeaderboardTable allRows={result.rows} />;
}
