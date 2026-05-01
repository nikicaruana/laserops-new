import { redirect } from "next/navigation";

/**
 * Default landing for /dashboards — sends users to the first leaderboard.
 * This keeps `/dashboards` as a routable URL without forcing a separate
 * landing page; the tab bar handles navigation discoverability.
 */
export default function DashboardsRootPage() {
  redirect("/dashboards/leaderboards/all-time");
}
