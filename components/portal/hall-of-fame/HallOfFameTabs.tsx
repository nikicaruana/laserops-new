"use client";

import { useState } from "react";
import React from "react";

/**
 * HallOfFameTabs
 * --------------------------------------------------------------------
 * Tab navigation for the three Hall of Fame sections. All children are
 * rendered server-side (data fetched on load); only the active one is
 * visible — no remounting of async subtrees on tab switch.
 *
 * Props:
 *   labels   — one tab label per child (order must match)
 *   children — one React node per label
 */

type Props = {
  labels: string[];
  children: React.ReactNode;
};

export function HallOfFameTabs({ labels, children }: Props) {
  const [active, setActive] = useState(0);
  const childArray = React.Children.toArray(children);

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
            onClick={() => setActive(i)}
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
