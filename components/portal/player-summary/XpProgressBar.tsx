"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * XpProgressBar
 * --------------------------------------------------------------------
 * Horizontal progress bar showing % progress within the current level.
 *
 * The fill bar starts (in the DOM, server-rendered) without the .is-filled
 * class. CSS rule .xp-fill says width: 0. After IntersectionObserver fires,
 * we add .is-filled directly to the element via classList.add — bypassing
 * React state entirely. CSS .xp-fill.is-filled then sets width to the
 * target, and .xp-fill's `transition: width` runs the animation.
 *
 * Why bypass React state:
 *
 *   Three previous attempts using React state had timing issues. The bar
 *   would render at its target width without animating. Theories included
 *   batching of false → true updates before paint, SSR hydration timing,
 *   and double effects in Strict Mode.
 *
 *   Direct DOM class manipulation eliminates all of those: the SSR HTML
 *   ships with class="xp-fill ..." (no is-filled), the browser paints
 *   that, the effect runs, classList.add runs, the browser sees a
 *   genuine class change and runs the transition.
 *
 * Honours prefers-reduced-motion via a CSS @media rule on .xp-fill.
 */

type XpProgressBarProps = {
  /** Progress 0-100. We clamp defensively. */
  pct: number;
  ariaLabel?: string;
  className?: string;
};

export function XpProgressBar({ pct, ariaLabel, className }: XpProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, pct));
  const display = Math.round(clamped);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const fillRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const fill = fillRef.current;
    if (!wrapper || !fill) return;

    // Reset on every pct change so switching players re-plays.
    fill.classList.remove("is-filled");

    // Force a synchronous reflow read so the browser commits the unfilled
    // state to a paint frame BEFORE we add the class. Reading offsetWidth
    // is the well-known incantation for "flush pending style changes."
    // This is the key to making the transition reliable: the browser
    // genuinely sees an "unfilled → filled" transition rather than only
    // the final state.
    // `void` discards the read while keeping ESLint happy about the bare
    // expression (no-unused-expressions).
    void fill.offsetWidth;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      fill.classList.add("is-filled");
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      // Fallback: just add the class.
      fill.classList.add("is-filled");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            // Force another reflow to lock in the unfilled state, then
            // add the class. Belt and braces.
            void fill.offsetWidth;
            fill.classList.add("is-filled");
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(wrapper);

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
      <div
        ref={fillRef}
        className="xp-fill h-full bg-accent"
        style={{ "--xp-target-pct": `${clamped}%` } as React.CSSProperties}
      />
    </div>
  );
}
