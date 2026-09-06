"use client";

/**
 * components/admin/LiveFeedToggle.tsx
 * --------------------------------------------------------------------
 * Per-match switch to enable the live feed: turns on the tablet listener (Live
 * auto-ingest) and the player + admin live views. Off by default — private
 * bookings just upload JSONs manually afterwards. Admin-only (matches RLS).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LiveFeedToggle({ matchId, enabled }: { matchId: string; enabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function toggle() {
    const next = !on;
    setBusy(true);
    setErr(null);
    setOn(next); // optimistic
    const { error } = await createClient().from("matches").update({ live_feed_enabled: next }).eq("id", matchId);
    setBusy(false);
    if (error) { setOn(!next); setErr(error.message); return; }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={busy}
        onClick={toggle}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${on ? "bg-accent" : "bg-border-strong"}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-bg transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
      </button>
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-text">
        Live feed {on ? <span className="text-accent">on</span> : <span className="text-text-subtle">off</span>}
      </span>
      <span className="text-[0.65rem] text-text-subtle">
        {on
          ? "Tablet listener + player/admin live views are active for this game."
          : "Off — no live streaming; upload JSONs manually after the game. Turn on for public games."}
      </span>
      {err && <span className="w-full text-xs text-red-400">{err}</span>}
    </div>
  );
}
