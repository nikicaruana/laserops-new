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
    // Count once per tab per day: a refresh is not a new visit, and the server
    // hash alone can split one person if their IP changes between loads (VPN,
    // IPv6 rotation, wifi to mobile data). The flag holds no identifier and is
    // never sent anywhere; it only suppresses the repeat ping.
    const key = `lo_pv:${path}:${new Date().toDateString()}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch { /* storage blocked: count anyway */ }
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
