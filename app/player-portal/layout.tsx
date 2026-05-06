import type { Metadata } from "next";

/**
 * Player Portal layout.
 *
 * Wraps every page under /player-portal. The site-wide Header is rendered
 * by the root layout above us, so users always have a way out of the portal.
 *
 * Navigation between Leaderboards / Player Stats / Match Report is handled
 * by the main site nav (desktop dropdown + mobile nav items) — no separate
 * in-page tab strip needed.
 *
 * Each sub-section layout (leaderboards, player-stats) adds its own
 * second-level SubTabs row as needed.
 */

export const metadata: Metadata = {
  title: {
    default: "Player Portal",
    template: "%s | Player Portal",
  },
  // Noindex while we iterate; flip this on once content is stable.
  robots: { index: false, follow: false },
};

export default function PlayerPortalLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-bg">{children}</div>;
}
