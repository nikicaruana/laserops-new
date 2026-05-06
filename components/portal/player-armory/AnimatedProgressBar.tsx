"use client";

import { useEffect, useRef, useState } from "react";

/**
 * AnimatedProgressBar
 * --------------------------------------------------------------------
 * A horizontal progress bar that fills smoothly from 0 to `pct` over 2s
 * once `play` is true. Uses the same CSS-class-toggle pattern as
 * `XpProgressBar` (see app/globals.css `.armory-progress-fill`):
 *   - Initial render: width: 0 (set by the CSS rule)
 *   - On `play=true`: a `.is-filled` class is added and the CSS
 *     transition takes over, filling to `--armory-target-pct`.
 *
 * Why class-toggle instead of inline style{ width }?
 *   - React renders both the initial 0 and the target value in the same
 *     reconciliation when the prop changes; the browser collapses them
 *     into a single style without any transition. Forcing a class
 *     change after a layout flush guarantees the browser sees an
 *     intermediate "0% → target" frame and runs the transition.
 *
 * Used by both ArmoryCard (where `play` follows IntersectionObserver
 * inView) and ArmoryDetailDialog (where `play` follows the dialog's
 * open state — it's true whenever the dialog is mounted).
 */

type Props = {
  /** 0–100. Clamped defensively. */
  pct: number;
  /** Set to true when the bar should animate to its target. */
  play: boolean;
  /** Bar height + colour overrides. Defaults match the card style. */
  className?: string;
  /** Track background class — defaults to `bg-bg`. */
  trackClassName?: string;
};

export function AnimatedProgressBar({
  pct,
  play,
  className = "h-1.5",
  trackClassName = "bg-bg",
}: Props) {
  const [filled, setFilled] = useState(false);
  const fillRef = useRef<HTMLDivElement>(null);
  const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));

  useEffect(() => {
    if (!play) {
      setFilled(false);
      return;
    }
    const el = fillRef.current;
    if (!el) return;
    // Force a layout read so the browser registers the initial width: 0
    // before we toggle to the filled state. Without this, React's batched
    // commit can collapse both states into one paint and skip the
    // transition entirely.
    void el.offsetWidth;
    setFilled(true);
  }, [play]);

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`w-full overflow-hidden rounded-sm ${trackClassName} ${className}`}
    >
      <div
        ref={fillRef}
        className={`armory-progress-fill h-full bg-accent${filled ? " is-filled" : ""}`}
        style={
          {
            // CSS variable consumed by the .armory-progress-fill.is-filled
            // rule in globals.css.
            "--armory-target-pct": `${clamped}%`,
          } as React.CSSProperties
        }
      />
    </div>
  );
}
