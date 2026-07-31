"use client";

/**
 * components/admin/AdminIdleLogout.tsx
 * --------------------------------------------------------------------
 * Signs the admin out after a period of inactivity, so a walked-away device
 * doesn't stay open on the admin panel. Any real interaction resets the timer;
 * a lightweight interval checks the elapsed idle time (no timer churn on every
 * mousemove). Mounted in the admin layout only.
 */
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const IDLE_MS = 15 * 60 * 1000; // 15 minutes

export function AdminIdleLogout() {
  useEffect(() => {
    let last = Date.now();
    const reset = () => {
      last = Date.now();
    };
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));

    const interval = setInterval(() => {
      if (Date.now() - last < IDLE_MS) return;
      clearInterval(interval);
      const supabase = createClient();
      supabase.auth.signOut().finally(() => {
        window.location.assign("/player-portal/login?next=/admin&timeout=1");
      });
    }, 30_000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      clearInterval(interval);
    };
  }, []);

  return null;
}
