import { AddToHomeScreen } from "@/components/portal/AddToHomeScreen";

/**
 * DashboardPageHeader — compact title row used at the top of each portal page.
 *
 * Layout:
 *   - Mobile: title on the left, optional Add-to-Home-Screen button on the right.
 *   - sm+: title centered, A2HS button hidden (it's lg:hidden in its own component
 *     and not relevant on desktop anyway).
 *
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
    <div className="mb-5 flex items-end justify-between gap-4 sm:mb-6 sm:justify-center">
      <h1 className="text-2xl font-extrabold leading-tight sm:text-center sm:text-3xl">
        {title}
      </h1>
      {!hideAddToHome && <AddToHomeScreen />}
    </div>
  );
}
