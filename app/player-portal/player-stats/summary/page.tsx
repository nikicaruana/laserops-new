import type { Metadata } from "next";
import { Suspense } from "react";
import {
  fetchAllPlayerStats,
  listAllNicknames,
} from "@/lib/player-stats/shared";
import { TableErrorState } from "@/components/portal/tables/TableErrorState";
import { PlayerSummaryView } from "@/components/portal/player-summary/PlayerSummaryView";

export const metadata: Metadata = {
  title: "Summary",
};

/**
 * Player Summary page.
 *
 * Server fetches all player rows once (cached 5min) then hands them to the
 * client view, which:
 *   - Reads ?ops= from the URL to determine which player to show
 *   - Renders the search input with full autocomplete suggestions
 *   - Renders the player's top-section cards (profile, level, weapon)
 *
 * Stats and Accolades sections will be added later as collapsible blocks
 * below the top section.
 *
 * Suspense boundary: PlayerSummaryView reads useSearchParams, so it must
 * sit inside a Suspense boundary or the entire page bails out of static
 * rendering. Wrapping just the view keeps the rest of the page eligible.
 */
export default async function PlayerSummaryPage() {
  const result = await fetchAllPlayerStats();

  if (!result.ok) {
    // Same error treatment we use elsewhere in the portal — keeps the
    // failure mode visually consistent across leaderboards and the summary.
    return <TableErrorState detail={result.error} />;
  }

  const knownNicknames = listAllNicknames(result.rows);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Suspense fallback={null}>
        <PlayerSummaryView
          allRows={result.rows}
          knownNicknames={knownNicknames}
        />
      </Suspense>
    </div>
  );
}
