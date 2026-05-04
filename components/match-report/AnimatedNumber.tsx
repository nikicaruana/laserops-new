"use client";

import { useEffect, useState } from "react";

/**
 * AnimatedNumber
 * --------------------------------------------------------------------
 * Counts from 0 to `value` over a short duration, formatting the
 * displayed string per `format`. Pure CSS animations can't interpolate
 * numeric values displayed as text, so we drive the count with rAF.
 *
 * Restarts on value-change: if the same component instance receives a
 * new value, it animates from 0 to the new value. To restart on a
 * different player selection (where you want the animation to play
 * again even if the value coincidentally matches), pass a `key` that
 * changes — React will unmount and remount, triggering a fresh start.
 *
 * Honors prefers-reduced-motion: skips the animation entirely if the
 * user has it set, jumping straight to the final value.
 */

type Format = "int" | "float" | "comma" | "percent";

const ANIMATION_DURATION_MS = 1200;

export function AnimatedNumber({
  value,
  format,
  duration = ANIMATION_DURATION_MS,
}: {
  value: number;
  format: Format;
  duration?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    // Respect reduced-motion preference. SSR-safe: window check.
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setDisplayValue(value);
      return;
    }

    let rafId: number | null = null;
    const startTime = performance.now();
    const startValue = 0;
    const endValue = value;

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic — fast at the start, slowing as it reaches
      // the target. Reads more "satisfying" than linear.
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + (endValue - startValue) * eased);

      if (progress < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    }

    rafId = window.requestAnimationFrame(tick);

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
    // Intentionally NOT including `duration` — changing duration mid-
    // animation isn't a use case we need to support.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{formatNumber(displayValue, format)}</>;
}

/* ---------- Formatting ---------- */

function formatNumber(n: number, format: Format): string {
  switch (format) {
    case "int":
      // Round during animation so partial values aren't shown
      return Math.round(n).toString();
    case "float":
      // Two decimal places throughout — animates smoothly through
      // 0.00 → 1.23 → 2.49 etc.
      return n.toFixed(2);
    case "comma":
      // Comma-separated integer (e.g. 10,948). Round during animation.
      return Math.round(n).toLocaleString("en-US");
    case "percent":
      // The caller passes a 0-100 value; we display as integer percent.
      return `${Math.round(n)}%`;
  }
}
