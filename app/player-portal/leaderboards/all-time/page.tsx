import type { Metadata } from "next";
import { AddToHomeScreen } from "@/components/portal/AddToHomeScreen";
import { CollapsibleSection } from "@/components/portal/CollapsibleSection";
import { XPLevelsLeaderboard } from "@/components/portal/tables/XPLevelsLeaderboard";

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
 *     wrapping a single leaderboard table. For now there's just one: XP/Levels.
 *     More tables will join (Wins, K/D, Accuracy, etc.) — the structure stays
 *     the same and the page grows as a stack.
 *
 * Each section's title (H2) is the click target that toggles the table open
 * or closed. Default state: open. Animated via native <details> + CSS
 * (see CollapsibleSection and the .collapsible-section rules in globals.css).
 *
 * Page is async because XPLevelsLeaderboard fetches data on the server.
 * Next.js handles the async boundary inside the CollapsibleSection's children
 * automatically — the <details> wrapper renders synchronously, the table
 * inside resolves when its fetch completes.
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
    </div>
  );
}
