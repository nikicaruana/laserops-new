"use client";

import { useEffect } from "react";

/**
 * EngagedSessionTracker
 * --------------------------------------------------------------------
 * Fires a single `engaged_session` dataLayer event once the visitor has
 * been ACTIVELY on the site for ACTIVE_SECONDS AND has made at least
 * INTERACTION_THRESHOLD interactions (click / keypress / scroll).
 *
 * "Active" time only accrues while the tab is visible, so a backgrounded
 * tab doesn't count. Fires at most once per browser session (sessionStorage
 * flag) so SPA navigations and reloads don't re-fire it.
 *
 * Rendered once in the root layout — this is a site-wide signal, not a
 * per-page one.
 */
const ACTIVE_SECONDS = 30;
const INTERACTION_THRESHOLD = 2;
const SESSION_KEY = "laserops_engaged_session";

export function EngagedSessionTracker() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch {
      // sessionStorage unavailable (private mode) — run without the guard.
    }

    let activeSeconds = 0;
    let interactions = 0;
    let done = false;
    let timer: ReturnType<typeof setInterval>;

    const interactionEvents = ["click", "keydown", "scroll"] as const;

    const onInteract = () => {
      interactions += 1;
      maybeFire();
    };

    function maybeFire() {
      if (done) return;
      if (
        activeSeconds >= ACTIVE_SECONDS &&
        interactions >= INTERACTION_THRESHOLD
      ) {
        done = true;
        try {
          sessionStorage.setItem(SESSION_KEY, "1");
        } catch {
          // ignore
        }
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: "engaged_session" });
        cleanup();
      }
    }

    function cleanup() {
      clearInterval(timer);
      for (const evt of interactionEvents) {
        window.removeEventListener(evt, onInteract);
      }
    }

    timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        activeSeconds += 1;
        maybeFire();
      }
    }, 1000);

    for (const evt of interactionEvents) {
      window.addEventListener(evt, onInteract, { passive: true });
    }

    return cleanup;
  }, []);

  return null;
}
