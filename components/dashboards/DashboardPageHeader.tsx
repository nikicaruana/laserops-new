import { AddToHomeScreen } from "@/components/dashboards/AddToHomeScreen";

/**
 * DashboardPageHeader — compact title row used at the top of each dashboard page.
 *
 * Layout: title on the left, optional Add-to-Home-Screen button on the right.
 * Title sizing is intentionally smaller than the marketing site's H1 — these
 * are sub-pages of a portal, not landing pages.
 */
type DashboardPageHeaderProps = {
  title: string;
  /** Hide the A2HS button (e.g. for placeholder pages where we don't want noise) */
  hideAddToHome?: boolean;
};

export function DashboardPageHeader({ title, hideAddToHome }: DashboardPageHeaderProps) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 sm:mb-6">
      <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">
        {title}
      </h1>
      {!hideAddToHome && <AddToHomeScreen />}
    </div>
  );
}
