import type { Metadata } from "next";
import { DashboardPageHeader } from "@/components/portal/DashboardPageHeader";
import { ComingSoon } from "@/components/portal/ComingSoon";

export const metadata: Metadata = {
  title: "Summary",
};

export default function PlayerSummaryPage() {
  return (
    <>
      <DashboardPageHeader title="Summary" hideAddToHome />
      <ComingSoon
        feature="Player Summary"
        hint="Look up your ops tag to see your level, total XP, recent matches, and badges at a glance."
      />
    </>
  );
}
