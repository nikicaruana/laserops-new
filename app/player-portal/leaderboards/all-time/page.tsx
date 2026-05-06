import type { Metadata } from "next";
import { Suspense } from "react";
import { AddToHomeScreen } from "@/components/portal/AddToHomeScreen";
import { LeaderboardCarousel } from "@/components/portal/LeaderboardCarousel";
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
 * One leaderboard is shown at a time. The user cycles through them with
 * ← / → buttons flanking the table title. All leaderboard components are
 * rendered server-side (data is fetched on load); only the active one is
 * visible — no remounting on navigation.
 */
export default async function AllTimeLeaderboardPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Mobile-only Install App button */}
      <div className="mb-4 flex justify-end sm:hidden">
        <AddToHomeScreen />
      </div>

      <LeaderboardCarousel
        labels={[
          "XP / Levels",
          "Match / Round Wins",
          "Score",
          "Kills",
          "Damage",
          "Accuracy",
          "Accolades",
        ]}
      >
        <XPLevelsLeaderboard />
        <Suspense fallback={null}>
          <MatchRoundWinsLeaderboard />
        </Suspense>
        <Suspense fallback={null}>
          <ScoreLeaderboard />
        </Suspense>
        <Suspense fallback={null}>
          <KillsLeaderboard />
        </Suspense>
        <Suspense fallback={null}>
          <DamageLeaderboard />
        </Suspense>
        <Suspense fallback={null}>
          <AccuracyLeaderboard />
        </Suspense>
        <Suspense fallback={null}>
          <AccoladesLeaderboard />
        </Suspense>
      </LeaderboardCarousel>
    </div>
  );
}
