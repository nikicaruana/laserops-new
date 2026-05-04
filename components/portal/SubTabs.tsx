"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

/**
 * SubTabs — second-level Player Portal navigation.
 *
 * Visual treatment: pill-style. Active tab gets a yellow border + yellow
 * text on a slightly elevated dark fill. Inactive tabs are muted text only.
 * This is deliberately distinct from PortalTabs (underline + text color)
 * so the two navigation levels don't read as the same control.
 *
 * Layout: matches PortalTabs — left-aligned on mobile, centered at sm+.
 * Mobile keeps overflow-x-auto as a safety net if labels ever grow.
 *
 * --------------------------------------------------------------------
 * forwardParams — carrying state across subtab navigation
 *
 * Some subtab groups want to keep a piece of URL state when the user
 * jumps from one subtab to another. The Player Stats group is the
 * primary example: ?ops=Glenn says "I'm looking at Glenn", and that
 * should follow you when you bounce from Summary → History.
 *
 * Pass `forwardParams` with the query keys that should ride along
 * (e.g. `["ops"]`). For each tab href that doesn't already specify
 * those keys, we read them off the current URL and append them. Keys
 * not present in the current URL are skipped — we don't invent
 * empty values.
 *
 * The "doesn't already specify" check matters: a tab definition can
 * still hard-code a destination param (e.g. `?ops=__SOME_DEFAULT__`)
 * and the forward logic won't clobber it.
 * --------------------------------------------------------------------
 */

type SubTab = {
  label: string;
  href: string;
};

type SubTabsProps = {
  tabs: SubTab[];
  /**
   * Names of query params on the current URL that should be appended
   * to each tab's href when navigating. Use for state that's
   * "about which entity I'm looking at" rather than "about how this
   * page is configured" — the former should follow you across tabs;
   * the latter shouldn't.
   *
   * Example: `forwardParams={["ops"]}` on the Player Stats subtabs
   * carries the selected player from Summary to History to Armory.
   */
  forwardParams?: string[];
};

export function SubTabs({ tabs, forwardParams }: SubTabsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="border-b border-border bg-bg-elevated/40">
      <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-8 lg:px-12">
        {/* overflow-x-auto with hidden scrollbars for the mobile fallback
            if labels grow. Whitespace-nowrap keeps each pill on one line.
            sm:justify-center mirrors the PortalTabs centering. */}
        <div className="flex items-center gap-2 overflow-x-auto py-3 sm:justify-center sm:gap-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => {
            const isActive =
              pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            // Compute the final href once per render. If no
            // forwardParams or none are present, this returns the
            // original href untouched.
            const href = appendForwardedParams(
              tab.href,
              searchParams,
              forwardParams,
            );
            return (
              <Link
                key={tab.href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-sm border px-3 py-1.5 transition-colors",
                  "text-[0.7rem] font-semibold uppercase tracking-[0.14em] sm:text-xs",
                  isActive
                    ? "border-accent bg-bg-overlay text-accent"
                    : "border-transparent text-text-subtle hover:border-border-strong hover:text-text-muted",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Append a subset of the current URL's query params to a target href.
 *
 * Rules:
 *   - If the tab's href already specifies a key, the existing value
 *     wins (no clobber).
 *   - If the current URL doesn't have a value for a key, we skip it
 *     (no empty `?ops=` appended).
 *   - Returns the original href unchanged when there's nothing to add.
 *
 * Implementation note: we don't use `new URL(...)` because it requires
 * a base/origin and our hrefs are root-relative. Splitting on `?` gives
 * us the path and query separately; URLSearchParams handles the rest.
 */
function appendForwardedParams(
  href: string,
  current: URLSearchParams,
  keys: string[] | undefined,
): string {
  if (!keys || keys.length === 0) return href;

  const [path, existingQuery = ""] = href.split("?");
  const params = new URLSearchParams(existingQuery);

  let added = false;
  for (const key of keys) {
    // Don't clobber a value the tab definition pinned itself.
    if (params.has(key)) continue;
    const value = current.get(key);
    if (value === null || value === "") continue;
    params.set(key, value);
    added = true;
  }

  if (!added && existingQuery === "") return href;
  const queryString = params.toString();
  return queryString === "" ? path : `${path}?${queryString}`;
}
