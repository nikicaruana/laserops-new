"use client";

/**
 * components/layout/ActivityPing.tsx
 * --------------------------------------------------------------------
 * Records that a signed-in user actually used the site (not just logged in), so
 * the admin "active in last 24h" count reflects real usage. Calls the throttled
 * touch_last_seen RPC on mount + when the tab regains focus. Self-limits with a
 * localStorage guard (>=5 min between calls) and the RPC self-throttles the DB
 * write, so this is cheap. Renders nothing; no-op for signed-out visitors.
 */
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const KEY = "lo_last_seen_ping";
const MIN_MS = 5 * 60 * 1000;

export function ActivityPing() {
  useEffect(() => {
    const ping = async () => {
      try {
        const now = Date.now();
        let last = 0;
        try { last = Number(localStorage.getItem(KEY) || 0); } catch { /* private mode */ }
        if (now - last < MIN_MS) return;
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        try { localStorage.setItem(KEY, String(now)); } catch { /* ignore */ }
        await supabase.rpc("touch_last_seen");
      } catch {
        /* activity tracking is best-effort */
      }
    };
    ping();
    const onVisible = () => { if (document.visibilityState === "visible") ping(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", ping);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", ping);
    };
  }, []);
  return null;
}
