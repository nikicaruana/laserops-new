"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/**
 * SubTabs — second-level dashboard navigation.
 *
 * Visual treatment: pill-style. Active tab gets a yellow border + yellow
 * text on a slightly elevated dark fill. Inactive tabs are muted text only.
 * This is deliberately distinct from PortalTabs (underline + text color)
 * so the two navigation levels don't read as the same control.
 *
 * Mobile: tabs row scrolls horizontally if it doesn't fit. On the very
 * narrow phones we have just three subtabs per section so this rarely
 * matters, but the scroll-on-overflow is a safety net.
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
        {/* overflow-x-auto with hidden scrollbars for the mobile fallback
            if labels grow. Whitespace-nowrap keeps each pill on one line. */}
        <div className="flex items-center gap-2 overflow-x-auto py-3 sm:gap-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
