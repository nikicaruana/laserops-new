import type { Metadata } from "next";
import { Suspense } from "react";
import { AddToHomeScreen } from "@/components/portal/AddToHomeScreen";
import { CollapsibleSection } from "@/components/portal/CollapsibleSection";
import { XPLevelsLeaderboard } from "@/components/portal/tables/XPLevelsLeaderboard";
import { MatchRoundWinsLeaderboard } from "@/components/portal/tables/MatchRoundWinsLeaderboard";

export const metadata: Metadata = {
  title: "All Time",
};

/**
 * All-Time leaderboards page.
 *
 * Structure:
 *   - The page itself has no big H1 — the active subtab "ALL TIME" in the
 *     navigation already labels it.
 *   - Mobile-only "Pin to Home" button floats top-right of the content area.
 *   - The page body is a stack of collapsible <CollapsibleSection>s, each
 *     wrapping a single leaderboard table.
 *
 * Each section's title (H2) is the click target that toggles the table open
 * or closed. Default state: open. Animated via native <details> + CSS
 * (see CollapsibleSection and the .collapsible-section rules in globals.css).
 *
 * Page is async because the leaderboard components fetch data on the server.
 * Next.js handles the async boundaries inside the CollapsibleSection's
 * children automatically.
 *
 * Suspense boundary: any leaderboard whose client component reads URL search
 * params (useSearchParams) needs to be inside a Suspense boundary, otherwise
 * the entire page opts out of static rendering with a build-time warning.
 * MatchRoundWinsLeaderboard reads ?year and ?month, so it gets its own
 * Suspense wrapper; XPLevelsLeaderboard doesn't read params and doesn't need one.
 */
export default async function AllTimeLeaderboardPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Mobile-only Pin to Home button row. Hidden entirely on desktop —
          the A2HS button itself is sm:hidden, so on desktop this row would
          just be empty whitespace. */}
      <div className="mb-4 flex justify-end sm:hidden">
        <AddToHomeScreen />
      </div>

      {/* Stacked collapsible sections. Add more <CollapsibleSection> blocks
          below this one as new leaderboards come online. */}
      <CollapsibleSection title="XP / Levels">
        <XPLevelsLeaderboard />
      </CollapsibleSection>

      <CollapsibleSection title="Match / Round Wins">
        <Suspense fallback={null}>
          <MatchRoundWinsLeaderboard />
        </Suspense>
      </CollapsibleSection>
    </div>
  );
}
