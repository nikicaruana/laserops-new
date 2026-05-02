import type { Metadata } from "next";
import { DashboardPageHeader } from "@/components/portal/DashboardPageHeader";
import { fetchSeasons, getActiveSeason } from "@/lib/cms/seasons";
import { fetchChallenges } from "@/lib/cms/challenges";
import { fetchSeasonChallenges } from "@/lib/leaderboards/season-challenges";
import { SeasonalChallengesView } from "@/components/portal/challenges/SeasonalChallengesView";

export const metadata: Metadata = {
  title: "Seasonal Challenges",
};

/**
 * Challenges leaderboard tab.
 *
 * Server-side flow:
 *   1. Fetch all seasons + pick the active one (with completed-fallback)
 *   2. Fetch challenges for that season
 *   3. Run them through the engine to produce ranked entries
 *   4. Hand to the view
 *
 * If any step yields nothing (no seasons, no challenges, no data), the
 * view shows an appropriate empty state — the page never blank-screens.
 */
export default async function ChallengesLeaderboardPage() {
  const seasons = await fetchSeasons();
  const activeSeason = getActiveSeason(seasons);

  let challengeData: Awaited<ReturnType<typeof fetchSeasonChallenges>> = [];
  if (activeSeason) {
    const challenges = await fetchChallenges(activeSeason.number);
    challengeData = await fetchSeasonChallenges(activeSeason, challenges);
  }

  return (
    <>
      <DashboardPageHeader title="Seasonal Challenges" hideAddToHome />
      <SeasonalChallengesView season={activeSeason} challengeData={challengeData} />
    </>
  );
}
