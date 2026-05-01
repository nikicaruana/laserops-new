import type { Metadata } from "next";
import { DashboardPageHeader } from "@/components/portal/DashboardPageHeader";
import { ComingSoon } from "@/components/portal/ComingSoon";

export const metadata: Metadata = {
  title: "Challenges",
};

export default function ChallengesLeaderboardPage() {
  return (
    <>
      <DashboardPageHeader title="Challenges" hideAddToHome />
      <ComingSoon
        feature="Seasonal Challenges"
        hint="Limited-time objectives with leaderboards and badges. Land soon."
      />
    </>
  );
}
