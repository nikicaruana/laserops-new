"use client";

import { useEffect, useRef, useState } from "react";

/**
 * AnimatedValue
 * --------------------------------------------------------------------
 * Counts a numeric value up from zero to its final display value on
 * first scroll-into-view. Works with the formats produced by summary-stats:
 *
 *   "42"       pure integer (no animation for 0)
 *   "1,234"    comma-formatted integer  → counts up, comma-formatted
 *   "75%"      integer percentage       → "0%" → "75%"
 *   "21.3%"    decimal percentage       → "0.0%" → "21.3%"
 *   "2.15"     decimal                  → "0.00" → "2.15"
 *
 * Duration: 1400 ms with cubic ease-out — matches the rating pill animation
 * so they finish together on screen.
 *
 * Non-numeric strings ("N/A", plain text) are rendered statically.
 * Respects prefers-reduced-motion.
 */

type Parsed = {
  prefix: string;
  num: number;
  suffix: string;
  /** Decimal places in the original; 0 = integer. */
  decimals: number;
  /** True when the original value used en-US comma formatting. */
  useLocale: boolean;
};

function parseValue(value: string): Parsed | null {
  // Strip commas so "1,234" parses as 1234
  const stripped = value.replace(/,/g, "");
  // Allow optional non-digit prefix, a number (int or decimal), optional suffix
  const m = stripped.match(/^([^0-9]*)(\d+(?:\.\d+)?)(.*)$/);
  if (!m) return null;
  const num = parseFloat(m[2]);
  if (isNaN(num)) return null;

  const decimals = m[2].includes(".") ? m[2].split(".")[1].length : 0;
  const useLocale = decimals === 0 && value.includes(",");

  return {
    prefix: m[1],
    num,
    suffix: m[3],
    decimals,
    useLocale,
  };
}

function formatCurrent(p: Parsed, current: number): string {
  let numStr: string;
  if (p.decimals === 0) {
    const rounded = Math.round(current);
    numStr = p.useLocale ? rounded.toLocaleString("en-US") : String(rounded);
  } else {
    numStr = current.toFixed(p.decimals);
  }
  return `${p.prefix}${numStr}${p.suffix}`;
}

function makeZero(p: Parsed): string {
  return formatCurrent(p, 0);
}

type Props = {
  value: string;
  className?: string;
};

export function AnimatedValue({ value, className }: Props) {
  // Start with the final value — safe for SSR and no-JS users.
  const [displayed, setDisplayed] = useState(value);

  const spanRef    = useRef<HTMLSpanElement>(null);
  const animatedRef = useRef(false);

  // When value changes (new player selected), reset to zero and clear flag.
  useEffect(() => {
    animatedRef.current = false;
    const parsed = parseValue(value);
    setDisplayed(parsed && parsed.num > 0 ? makeZero(parsed) : value);
  }, [value]);

  // IntersectionObserver — trigger count-up on first view.
  useEffect(() => {
    const parsed = parseValue(value);
    if (!parsed || parsed.num === 0) {
      setDisplayed(value);
      return;
    }

    const el = spanRef.current;
    if (!el) return;

    // Honour reduced-motion: jump straight to final value.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayed(value);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || animatedRef.current) return;
        animatedRef.current = true;
        observer.disconnect();

        const DURATION = 1400; // ms — matches RatingPill animation length
        const startTime = performance.now();

        const frame = (now: number) => {
          const t = Math.min((now - startTime) / DURATION, 1);
          // Cubic ease-out: fast start, gentle finish
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplayed(formatCurrent(parsed, parsed.num * eased));

          if (t < 1) {
            requestAnimationFrame(frame);
          } else {
            // Snap to the exact original string at the end
            setDisplayed(value);
          }
        };

        requestAnimationFrame(frame);
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return (
    // suppressHydrationWarning: SSR emits the final value; the reset
    // useEffect immediately rewrites to "0" on the client before the user
    // can see it (the cards start off-screen).  The mismatch is intentional.
    <span ref={spanRef} className={className} suppressHydrationWarning>
      {displayed}
    </span>
  );
}
