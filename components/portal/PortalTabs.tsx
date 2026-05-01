"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/**
 * PortalTabs — top-level Player Portal navigation.
 *
 * Visual treatment: yellow underline + yellow text for the active tab.
 * Inactive tabs sit in muted text. This is the "tree A" look — the second
 * level (SubTabs) uses a different treatment (pills) so the two levels
 * read as distinct without introducing a second hue.
 *
 * Layout: centered at all viewport widths. Mobile centering with only 2
 * items leaves some empty space on either side, but reads as deliberate
 * portal-like symmetry — and the tap targets stay full-size since
 * centering doesn't shrink anything.
 *
 * URL-driven: the active tab is derived from the pathname. Each tab links
 * to the section root, which in turn redirects to its first subtab via
 * the section's page.tsx.
 */

type Tab = {
  label: string;
  href: string;
  /** URL prefix that means "this tab is active" — e.g. /player-portal/leaderboards */
  matchPrefix: string;
};

const tabs: Tab[] = [
  {
    label: "Leaderboards",
    href: "/player-portal/leaderboards",
    matchPrefix: "/player-portal/leaderboards",
  },
  {
    label: "Player Stats",
    href: "/player-portal/player-stats",
    matchPrefix: "/player-portal/player-stats",
  },
];

export function PortalTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Player portal sections"
      className="border-b border-border bg-bg"
    >
      {/* Outer container: width cap + horizontal padding inset. */}
      <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-8 lg:px-12">
        {/* Inner row: w-max + mx-auto centers when content fits, falls
            back to left-anchored when content overflows. Same pattern
            as SubTabs — sidesteps the `justify-content: center +
            overflow` quirk. */}
        <div className="mx-auto flex w-max max-w-full items-stretch gap-1 sm:gap-6 lg:gap-10">
          {tabs.map((tab) => {
            const isActive = pathname.startsWith(tab.matchPrefix);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  // Layout: no padding-left, just generous tap target. The relative
                  // box hosts the underline pseudo-bar.
                  "relative flex items-center px-3 py-3.5 sm:px-4 sm:py-4",
                  "text-xs font-bold uppercase tracking-[0.16em] transition-colors",
                  isActive
                    ? "text-accent"
                    : "text-text-muted hover:text-text",
                )}
              >
                {tab.label}
                {/* Underline bar — fills the tab's bottom edge when active.
                    Sits on top of the parent's bottom border for a clean overlap. */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-0 -bottom-px h-[2px] transition-colors",
                    isActive ? "bg-accent" : "bg-transparent",
                  )}
                />
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
