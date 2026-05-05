import { fetchGameDataRows } from "@/lib/game-data/lookup";
import { fetchAccolades } from "@/lib/cms/accolades";
import { fetchPeriodRows } from "@/lib/leaderboards/period-shared";
import { TableErrorState } from "@/components/portal/tables/TableErrorState";
import { AccoladesLeaderboardTable } from "@/components/portal/tables/AccoladesLeaderboardTable";

/**
 * AccoladesLeaderboard — server-side wrapper.
 *
 * Three parallel fetches:
 *   1. Game_Data_Lookup (per-match rows with the Accolade_<Name>
 *      0/1 columns) — the source of truth for "who earned what
 *      accolade in which match".
 *   2. CMS Accolades (canonical metadata: name, XP) — used to derive
 *      each accolade's tier from its XP value (100=T1, 75=T2, 50=T3).
 *   3. Period rows — used ONLY to derive year/month filter options
 *      that match the other leaderboards' dropdown. The period sheet
 *      has the canonical set of periods the rest of the all-time
 *      page uses, so reusing it keeps the four filter dropdowns in
 *      sync. (Aggregation itself doesn't use period rows.)
 *
 * All three run via Promise.all to avoid sequential wall-time. CMS
 * fetch failures aren't fatal — the aggregator can't tier those
 * accolades but still counts them toward each player's total. Game
 * data fetch failure IS fatal (no rows = no leaderboard).
 */
export async function AccoladesLeaderboard() {
  const [gameResult, accolades, periodResult] = await Promise.all([
    fetchGameDataRows(),
    fetchAccolades(),
    fetchPeriodRows(),
  ]);

  if (!gameResult.ok) {
    return <TableErrorState detail={gameResult.error} />;
  }

  return (
    <AccoladesLeaderboardTable
      allRows={gameResult.rows}
      accolades={accolades}
      // Period rows passed for filter-options derivation only. If
      // period fetch failed (.ok === false), pass an empty array
      // — the filter dropdown will be empty but the leaderboard
      // still renders (filter URL params are still honoured;
      // they just can't be picked from a UI menu).
      periodRowsForFilterOptions={periodResult.ok ? periodResult.rows : []}
    />
  );
}
