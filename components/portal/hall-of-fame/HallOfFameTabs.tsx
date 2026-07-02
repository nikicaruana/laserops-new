"use client";

import { useState } from "react";
import React from "react";
import { usePathname } from "next/navigation";

/**
 * HallOfFameTabs
 * --------------------------------------------------------------------
 * Tab navigation for the Hall of Fame sections, synced to a `?tab=` query
 * param so each section is shareable/linkable.
 *
 * The server reads `?tab=` (via the page's searchParams) and passes
 * `initialSlug`, so a shared link opens the right tab with no flash.
 * Clicking a tab updates the URL client-side with history.replaceState —
 * no Next navigation, so the page's server render (incl. the uncached
 * champions data) isn't re-run on a tab switch.
 *
 * Uses usePathname (not useSearchParams) so no Suspense boundary is needed.
 * All children render server-side; only the active one is visible.
 */

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type Props = {
  labels: string[];
  /** Slug of the tab to open initially (from `?tab=`), if any. */
  initialSlug?: string;
  children: React.ReactNode;
};

export function HallOfFameTabs({ labels, initialSlug, children }: Props) {
  const slugs = labels.map(slugify);
  const pathname = usePathname();
  const [active, setActive] = useState(() => {
    if (!initialSlug) return 0;
    const i = slugs.indexOf(initialSlug);
    return i >= 0 ? i : 0;
  });
  const childArray = React.Children.toArray(children);

  function select(i: number) {
    setActive(i);
    if (typeof window !== "undefined") {
      // Reflect the tab in the URL for sharing, without triggering a Next
      // navigation (which would re-run the page's server render).
      window.history.replaceState(null, "", `${pathname}?tab=${slugs[i]}`);
    }
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Hall of Fame sections"
        className="mb-6 flex flex-wrap items-center justify-center gap-2"
      >
        {labels.map((label, i) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={active === i}
            onClick={() => select(i)}
            className={`rounded-sm border px-3 py-2 text-[0.7rem] font-bold uppercase tracking-[0.1em] transition-colors sm:px-4 sm:text-xs ${
              active === i
                ? "border-accent bg-bg-overlay text-accent"
                : "border-border text-text-subtle hover:border-border-strong hover:text-text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div>
        {childArray.map((child, i) => (
          <div key={i} className={i === active ? "block" : "hidden"}>
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}
