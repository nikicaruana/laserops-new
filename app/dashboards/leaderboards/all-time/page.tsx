import type { Metadata } from "next";
import { DashboardFrame } from "@/components/dashboards/DashboardFrame";
import { DashboardPageHeader } from "@/components/dashboards/DashboardPageHeader";

export const metadata: Metadata = {
  title: "XP / Levels",
};

const LEADERBOARD_EMBED_URL =
  "https://datastudio.google.com/embed/reporting/564e652f-715a-48ee-ac6c-edf694760770/page/rPvwF";

/**
 * All-Time XP Leaderboard — the first live dashboard.
 *
 * Canvas resized to 950×1200 (was 950×600) so more rows fit and we don't
 * cut a row in half. More leaderboard tables will land below this one
 * over time as the live report grows; for now it's a single embed.
 */
export default function AllTimeLeaderboardPage() {
  return (
    <>
      <DashboardPageHeader title="XP / Levels" />
      <DashboardFrame
        embedUrl={LEADERBOARD_EMBED_URL}
        title="All-Time XP Leaderboard"
        canvasWidth={950}
        canvasHeight={1200}
      />
    </>
  );
}
