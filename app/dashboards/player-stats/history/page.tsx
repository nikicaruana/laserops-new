import type { Metadata } from "next";
import { DashboardPageHeader } from "@/components/dashboards/DashboardPageHeader";
import { ComingSoon } from "@/components/dashboards/ComingSoon";

export const metadata: Metadata = {
  title: "History",
};

export default function PlayerHistoryPage() {
  return (
    <>
      <DashboardPageHeader title="History" hideAddToHome />
      <ComingSoon
        feature="Match History"
        hint="Every match, every kill, every objective — your full operational record."
      />
    </>
  );
}
