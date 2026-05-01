import type { Metadata } from "next";
import { PortalTabs } from "@/components/dashboards/PortalTabs";

/**
 * Dashboards portal layout.
 *
 * Wraps every page under /dashboards. The site-wide Header is rendered
 * by the root layout above us, so users always have a way out of the portal.
 *
 * Within the portal we add:
 *   - PortalTabs: top-level tabs (Leaderboards | Player Stats)
 *   - A nested layout under each section adds its own SubTabs row
 *
 * Spacing is intentionally tighter than the marketing site — denser layout
 * for data-heavy pages. The "Pin to Home" button is rendered by each page's
 * DashboardPageHeader so it sits beside the title naturally.
 */

export const metadata: Metadata = {
  title: {
    default: "Dashboards",
    template: "%s | Dashboards",
  },
  // Noindex while we iterate; flip this on once content is stable.
  robots: { index: false, follow: false },
};

export default function DashboardsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bg">
      <PortalTabs />
      {children}
    </div>
  );
}
