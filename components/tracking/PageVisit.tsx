"use client";

/**
 * components/tracking/PageVisit.tsx
 * --------------------------------------------------------------------
 * First-party, consent-free visit counter for landing pages. Posts one `view`
 * to /api/track on mount (no cookies, no device storage), tagged with the
 * utm_source / src query param and the referrer. TrackedCta records CTA clicks
 * the same way and also pushes the GA4 `play_cta_click` dataLayer event, which
 * GTM already forwards to GA4 (consent-gated) with the `cta` id.
 */
import { useEffect, useRef, type ReactNode } from "react";

type Kind = "view" | "cta_signup" | "cta_games";

function send(path: string, kind: Kind) {
  try {
    const qs = new URLSearchParams(window.location.search);
    const payload = JSON.stringify({
      path,
      kind,
      source: qs.get("utm_source") ?? qs.get("src"),
      referrer: document.referrer,
    });
    // sendBeacon survives the navigation a CTA click triggers.
    if (!navigator.sendBeacon?.("/api/track", payload)) {
      void fetch("/api/track", { method: "POST", body: payload, keepalive: true });
    }
  } catch {
    /* counting is best-effort */
  }
}

export function PageVisit({ path }: { path: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    send(path, "view");
  }, [path]);
  return null;
}

/** Wraps a CTA (display: contents, so layout is untouched) and records clicks. */
export function TrackedCta({ path, kind, cta, children }: { path: string; kind: Exclude<Kind, "view">; cta: string; children: ReactNode }) {
  return (
    <span
      className="contents"
      onClick={() => {
        send(path, kind);
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: "play_cta_click", cta });
      }}
    >
      {children}
    </span>
  );
}
