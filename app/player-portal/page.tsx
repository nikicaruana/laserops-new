import { redirect } from "next/navigation";

/**
 * Default landing for /player-portal — sends users to the first leaderboard.
 * This keeps `/player-portal` as a routable URL without forcing a separate
 * landing page; the tab bar handles navigation discoverability.
 */
export default function PlayerPortalRootPage() {
  redirect("/player-portal/leaderboards/all-time");
}
