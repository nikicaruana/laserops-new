"use client";

import { useRef, useState, useEffect } from "react";

/**
 * useInView
 * --------------------------------------------------------------------
 * One-shot IntersectionObserver hook. Returns { ref, inView } where
 * `inView` flips from false → true once the attached element reaches
 * the given threshold in the viewport, and then stays true forever.
 *
 * Used by the player-history charts so Recharts entrance animations
 * play when the chart scrolls into view rather than firing as soon as
 * the component mounts (which happens off-screen for charts below the
 * fold).
 *
 * Pattern used in each chart:
 *   <ChartRoot key={String(inView)} isAnimationActive={inView} ...>
 *
 * When inView is false  → key="false", isAnimationActive=false → chart
 *   renders statically, no animation.
 * When inView flips true → key changes to "true" → Recharts remounts
 *   the chart root → animation fires with isAnimationActive=true.
 * --------------------------------------------------------------------
 */
export function useInView(threshold = 0.3) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}
