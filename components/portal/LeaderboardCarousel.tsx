"use client";

import { useState } from "react";
import React from "react";

/**
 * LeaderboardCarousel
 * --------------------------------------------------------------------
 * Replaces the stacked CollapsibleSection approach on the All-Time
 * leaderboard page. Shows one leaderboard at a time; the user cycles
 * through with ← / → buttons flanking the table title.
 *
 * All children are rendered (keeping server-component data-fetching
 * intact) but only the active one is visible — this avoids remounting
 * async subtrees on navigation and keeps the content available for
 * screen readers.
 *
 * Props:
 *   labels   — ordered list of table titles, one per child
 *   children — one React node per label (order must match)
 */

type Props = {
  labels: string[];
  children: React.ReactNode;
};

export function LeaderboardCarousel({ labels, children }: Props) {
  const [active, setActive] = useState(0);
  const total = labels.length;
  const childArray = React.Children.toArray(children);

  function prev() {
    setActive((i) => (i - 1 + total) % total);
  }
  function next() {
    setActive((i) => (i + 1) % total);
  }

  return (
    <div>
      {/* Navigation header */}
      <div className="flex items-center justify-between gap-3 py-3">
        {/* Previous button */}
        <button
          type="button"
          onClick={prev}
          aria-label="Previous leaderboard"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border text-text-muted transition-colors hover:border-border-strong hover:text-text focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <svg
            aria-hidden
            viewBox="0 0 12 12"
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
            strokeLinejoin="miter"
          >
            <path d="M8 2L4 6l4 4" />
          </svg>
        </button>

        {/* Title + counter */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
          <h2 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
            {labels[active]}
          </h2>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-subtle">
            {active + 1} / {total}
          </p>
        </div>

        {/* Next button */}
        <button
          type="button"
          onClick={next}
          aria-label="Next leaderboard"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border text-text-muted transition-colors hover:border-border-strong hover:text-text focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <svg
            aria-hidden
            viewBox="0 0 12 12"
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
            strokeLinejoin="miter"
          >
            <path d="M4 2l4 4-4 4" />
          </svg>
        </button>
      </div>

      {/* Table area — all children mounted, only active one visible */}
      <div className="pt-2">
        {childArray.map((child, i) => (
          <div key={i} className={i === active ? "block" : "hidden"}>
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}
