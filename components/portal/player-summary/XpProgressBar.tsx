"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * XpProgressBar
 * --------------------------------------------------------------------
 * Horizontal progress bar showing % progress within the current level.
 *
 * Animation is class-toggle driven — the most reliable cross-browser
 * pattern for "animate from one state to another." The fill bar starts
 * with NO `is-filled` class. CSS gives unfilled bars `width: 0`. After
 * the bar scrolls into view, we add `is-filled`, which CSS animates to
 * `width: var(--target-pct)`. This pattern is bulletproof because:
 *
 *   1. The CSS rules for both states are declared upfront — the browser
 *      always knows what it's transitioning between.
 *   2. The class toggle is a definitive state change React can't batch
 *      with the "no-class" state — the unclassed render commits before
 *      the classed render.
 *   3. No reliance on inline-style mutation, which behaves inconsistently
 *      across React 18/19, SSR, and concurrent rendering.
 *
 * Triggers on intersection so it animates when the user can actually see
 * it — important for any future bars in collapsed sections.
 *
 * Honours prefers-reduced-motion: jumps to final state with no animation.
 */

type XpProgressBarProps = {
  /** Progress 0-100. Caller is expected to clamp; we clamp again defensively. */
  pct: number;
  ariaLabel?: string;
  className?: string;
};

export function XpProgressBar({ pct, ariaLabel, className }: XpProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, pct));
  const display = Math.round(clamped);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  // Class flag: false → unfilled (CSS sets width: 0), true → filled (CSS
  // sets width: var(--xp-target-pct)). Only toggled true after the bar
  // scrolls into view.
  const [isFilled, setIsFilled] = useState(false);

  useEffect(() => {
    // Reset to unfilled when pct changes, so switching players plays the
    // animation again from empty.
    setIsFilled(false);

    const el = wrapperRef.current;
    if (!el) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      // Snap to final, no animation. CSS handles this via .motion-reduce
      // override but we also force the class on so width matches target.
      setIsFilled(true);
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      // No observer support → trigger after a brief delay so the unfilled
      // state has a chance to paint first.
      const timer = setTimeout(() => setIsFilled(true), 50);
      return () => clearTimeout(timer);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            // Slight delay so the unfilled (width:0) state definitively
            // commits to a paint before we toggle the class. 50ms is
            // imperceptible to the user but enough for the browser to
            // commit a frame.
            setTimeout(() => setIsFilled(true), 50);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [clamped]);

  return (
    <div
      ref={wrapperRef}
      role="progressbar"
      aria-label={ariaLabel ?? `XP progress: ${display}%`}
      aria-valuenow={display}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-sm border border-border bg-bg-overlay",
        className,
      )}
    >
      {/* The fill. Width is driven entirely by CSS rules:
            .xp-fill            → width: 0
            .xp-fill.is-filled  → width: var(--xp-target-pct)
          See globals.css. The transition is on the .xp-fill class so any
          width change animates. */}
      <div
        className={cn("xp-fill h-full bg-accent", isFilled && "is-filled")}
        style={{ "--xp-target-pct": `${clamped}%` } as React.CSSProperties}
      />
    </div>
  );
}
