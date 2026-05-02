import { AddToHomeScreen } from "@/components/portal/AddToHomeScreen";
import { cn } from "@/lib/cn";

/**
 * DashboardPageHeader — compact title row used at the top of each portal page.
 *
 * Layout:
 *   - Mobile with A2HS button: title on the left, button on the right
 *     (justify-between).
 *   - Mobile without A2HS button (hideAddToHome): title centered. There's
 *     no second element to flex against, so left-anchoring it would just
 *     leave an awkwardly empty right side.
 *   - sm+: title centered regardless. The A2HS button is sm:hidden in its
 *     own component.
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
    <div
      className={cn(
        "mb-5 flex items-end gap-4 sm:mb-6 sm:justify-center",
        // When the right-side button is hidden, there's no element to
        // anchor against on the right — center the title on mobile too.
        // When the button is visible, justify-between gives the button
        // a place at the right edge while keeping the title at the left.
        hideAddToHome ? "justify-center" : "justify-between",
      )}
    >
      <h1 className="text-2xl font-extrabold leading-tight sm:text-center sm:text-3xl">
        {title}
      </h1>
      {!hideAddToHome && <AddToHomeScreen />}
    </div>
  );
}
