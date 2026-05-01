import type { Metadata } from "next";
import { DashboardPageHeader } from "@/components/dashboards/DashboardPageHeader";
import { ComingSoon } from "@/components/dashboards/ComingSoon";

export const metadata: Metadata = {
  title: "Armory",
};

export default function PlayerArmoryPage() {
  return (
    <>
      <DashboardPageHeader title="Armory" hideAddToHome />
      <ComingSoon
        feature="Armory"
        hint="Your weapon usage, accuracy, and favourite loadouts — broken down by weapon."
      />
    </>
  );
}
