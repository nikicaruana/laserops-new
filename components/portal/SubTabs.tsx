"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/**
 * SubTabs — second-level Player Portal navigation.
 *
 * Visual treatment: pill-style. Active tab gets a yellow border + yellow
 * text on a slightly elevated dark fill. Inactive tabs are muted text only.
 * This is deliberately distinct from PortalTabs (underline + text color)
 * so the two navigation levels don't read as the same control.
 *
 * Layout strategy: the inner flex row uses `w-max + mx-auto` so it sizes
 * itself to its content's natural width and centers within the container.
 * If the content fits, you get clean centering. If the content overflows,
 * `max-w-full` clamps the row to the container width and `overflow-x-auto`
 * enables horizontal scroll — with the leftmost item naturally anchored
 * to the container's left edge (because the row is now full-width).
 *
 * This sidesteps the well-known `justify-content: center + overflow-x:
 * auto` quirk where left-overflowing content becomes unreachable. The
 * `safe center` keyword fixes the same issue but has spottier browser
 * support; the w-max pattern works everywhere.
 */

type SubTab = {
  label: string;
  href: string;
};

type SubTabsProps = {
  tabs: SubTab[];
};

export function SubTabs({ tabs }: SubTabsProps) {
  const pathname = usePathname();

  return (
    <div className="border-b border-border bg-bg-elevated/40">
      {/* Outer container: caps overall width on huge screens, provides
          horizontal padding inset from the viewport edges. The padding
          is deliberately tighter on mobile (px-3) than the rest of the
          portal chrome (px-4) to give the pill row maximum room. */}
      <div className="mx-auto w-full max-w-[90rem] px-3 sm:px-8 lg:px-12">
        {/* Outer wrapper: enables horizontal scroll if content exceeds
            container width. Hidden scrollbar for cleanliness. */}
        <div className="overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Inner row: w-max sizes to natural content width, mx-auto
              centers within the scrollable area. When content > container,
              max-w-full + the parent's overflow handle scrolling. */}
          <div className="mx-auto flex w-max max-w-full items-center gap-1.5 sm:gap-3">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    // Tighter padding/tracking on mobile so 3-tab rows
                    // like "ALL TIME / CHALLENGES / HALL OF FAME" fit
                    // narrow viewports comfortably. sm+ relaxes back.
                    "shrink-0 whitespace-nowrap rounded-sm border px-2 py-1.5 transition-colors sm:px-3",
                    "text-[0.65rem] font-semibold uppercase tracking-[0.1em] sm:text-xs sm:tracking-[0.14em]",
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
    </div>
  );
}
