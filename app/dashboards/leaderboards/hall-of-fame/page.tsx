import type { Metadata } from "next";
import { DashboardPageHeader } from "@/components/dashboards/DashboardPageHeader";
import { ComingSoon } from "@/components/dashboards/ComingSoon";

export const metadata: Metadata = {
  title: "Hall of Fame",
};

export default function HallOfFameLeaderboardPage() {
  return (
    <>
      <DashboardPageHeader title="Hall of Fame" hideAddToHome />
      <ComingSoon
        feature="Hall of Fame"
        hint="Career-defining records and once-in-a-season feats. Tracking the operatives who shaped the meta."
      />
    </>
  );
}
