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
 * Layout: centered at all viewport widths. Mobile keeps overflow-x-auto
 * as a safety net if labels ever grow past the viewport — when content
 * fits, justify-center keeps the pills centered; when it overflows,
 * the scroll naturally takes over (left-edge anchored, as with any
 * overflowing centered flex container).
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
      <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-8 lg:px-12">
        {/* overflow-x-auto + safe center: a flex row with both `justify-content:
            center` and `overflow-x: auto` has a known browser quirk — when
            content is wider than the container, the left half of the overflow
            becomes unscrollable (you can't scroll past scroll-left: 0, but
            centering pushes content into negative space).
            `justify-content: safe center` is the modern CSS keyword that
            falls back to `flex-start` when content overflows, so the leftmost
            pill stays reachable on narrow viewports. */}
        <div className="flex items-center [justify-content:safe_center] gap-2 overflow-x-auto py-3 sm:gap-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
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
