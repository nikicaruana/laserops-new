import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchAllPlayerStats } from "@/lib/player-stats/shared";
import { TableErrorState } from "@/components/portal/tables/TableErrorState";
import { PlayerSummaryView } from "@/components/portal/player-summary/PlayerSummaryView";
import { InstallAppButton } from "@/components/portal/AddToHomeScreen";

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
 *   - Renders the top section, stats, and accolades
 *
 * Suspense boundary: PlayerSummaryView reads useSearchParams, so it must
 * sit inside a Suspense boundary or the entire page bails out of static
 * rendering. Wrapping just the view keeps the rest of the page eligible.
 */
export default async function PlayerSummaryPage() {
  const result = await fetchAllPlayerStats();

  if (!result.ok) {
    return <TableErrorState detail={result.error} />;
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Mobile-only Install App button row. Hidden on desktop because the
          button itself is sm:hidden — desktop install is a niche flow we're
          not actively pushing. The button only renders if the device has an
          install path (Android Chrome with prompt available, or iOS Safari).
          On the player summary page specifically: high-intent users who've
          already engaged are the most likely to install. */}
      <div className="mb-4 flex justify-end sm:hidden">
        <InstallAppButton />
      </div>

      <Suspense fallback={null}>
        <PlayerSummaryView allRows={result.rows} />
      </Suspense>
    </div>
  );
}
