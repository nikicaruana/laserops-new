"use client";

import type { ReactNode } from "react";

/**
 * CtaTrack
 * --------------------------------------------------------------------
 * Wraps a CTA (button or link) and pushes a `play_cta_click` dataLayer
 * event when it's clicked, tagged with a `cta` id (e.g. "hero_open_game").
 *
 * Uses `display: contents` (Tailwind `contents`) so the wrapper adds no
 * box of its own — the wrapped control lays out exactly as if this span
 * weren't here (full-width buttons, flex/grid items all behave normally).
 * The click bubbles from the inner control to this span, so it works for
 * Next <Link>, plain <a>, and <button> alike.
 */
export function CtaTrack({
  cta,
  children,
}: {
  cta: string;
  children: ReactNode;
}) {
  return (
    <span
      className="contents"
      onClick={() => {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: "play_cta_click", cta });
      }}
    >
      {children}
    </span>
  );
}
