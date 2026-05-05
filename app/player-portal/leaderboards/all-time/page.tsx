import type { Metadata } from "next";
import { Suspense } from "react";
import { AddToHomeScreen } from "@/components/portal/AddToHomeScreen";
import { CollapsibleSection } from "@/components/portal/CollapsibleSection";
import { XPLevelsLeaderboard } from "@/components/portal/tables/XPLevelsLeaderboard";
import { MatchRoundWinsLeaderboard } from "@/components/portal/tables/MatchRoundWinsLeaderboard";
import { ScoreLeaderboard } from "@/components/portal/tables/ScoreLeaderboard";
import { KillsLeaderboard } from "@/components/portal/tables/KillsLeaderboard";
import { DamageLeaderboard } from "@/components/portal/tables/DamageLeaderboard";
import { AccuracyLeaderboard } from "@/components/portal/tables/AccuracyLeaderboard";
import { AccoladesLeaderboard } from "@/components/portal/tables/AccoladesLeaderboard";

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
 * Every leaderboard except XPLevelsLeaderboard reads ?year and ?month, so
 * they each get a Suspense wrapper.
 */
export default async function AllTimeLeaderboardPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Mobile-only Install App button row. Hidden entirely on desktop —
          the button itself is sm:hidden, so on desktop this row would
          just be empty whitespace. The button only shows when the device
          has a real install path: native prompt on Android, instructional
          modal on iOS, hidden if already installed or no path available. */}
      <div className="mb-4 flex justify-end sm:hidden">
        <AddToHomeScreen />
      </div>

      {/* Stacked collapsible sections. Add more <CollapsibleSection> blocks
          below as new leaderboards come online. */}
      <CollapsibleSection title="XP / Levels">
        <XPLevelsLeaderboard />
      </CollapsibleSection>

      <CollapsibleSection title="Match / Round Wins">
        <Suspense fallback={null}>
          <MatchRoundWinsLeaderboard />
        </Suspense>
      </CollapsibleSection>

      <CollapsibleSection title="Score">
        <Suspense fallback={null}>
          <ScoreLeaderboard />
        </Suspense>
      </CollapsibleSection>

      <CollapsibleSection title="Kills">
        <Suspense fallback={null}>
          <KillsLeaderboard />
        </Suspense>
      </CollapsibleSection>

      <CollapsibleSection title="Damage">
        <Suspense fallback={null}>
          <DamageLeaderboard />
        </Suspense>
      </CollapsibleSection>

      <CollapsibleSection title="Accuracy">
        <Suspense fallback={null}>
          <AccuracyLeaderboard />
        </Suspense>
      </CollapsibleSection>

      <CollapsibleSection title="Accolades">
        <Suspense fallback={null}>
          <AccoladesLeaderboard />
        </Suspense>
      </CollapsibleSection>
    </div>
  );
}
