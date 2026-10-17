"use client";

/**
 * components/admin/MatchModeToggle.tsx
 * --------------------------------------------------------------------
 * The match's scoring mode, chosen by the admin. ONLINE = live JSON event-stream
 * rounds (full stats). OFFLINE = kill-only scoring from a .lwa (and the kill
 * counters of any online rounds already ingested). Admins flip this at any point
 * — e.g. start online, hit issues, switch to offline mid-session. Switching to
 * offline does NOT delete already-ingested online rounds; at publish the whole
 * match is scored kill-only. Writes matches.scoring_mode.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TotpGate } from "@/components/admin/TotpGate";

export function MatchModeToggle({ matchId, mode }: { matchId: string; mode: "online" | "offline" }) {
  const router = useRouter();
  const [current, setCurrent] = useState<"online" | "offline">(mode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Switching the scoring mode reshapes how the whole match is scored, so it is
  // 2FA-gated: a click stages the target mode and opens TotpGate; the write only
  // runs once the code verifies.
  const [pending, setPending] = useState<"online" | "offline" | null>(null);

  function requestMode(next: "online" | "offline") {
    if (next === current || busy) return;
    setError(null);
    setPending(next);
  }

  async function applyMode() {
    const next = pending;
    if (!next) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const patch: { scoring_mode: string; live_feed_enabled?: boolean } = { scoring_mode: next };
    if (next === "offline") patch.live_feed_enabled = false; // offline games aren't streamed
    const { error: err } = await supabase.from("matches").update(patch).eq("id", matchId);
    setBusy(false);
    setPending(null);
    if (err) { setError(err.message); return; }
    setCurrent(next);
    router.refresh();
  }

  const opts: { key: "online" | "offline"; label: string; hint: string }[] = [
    { key: "online", label: "Online", hint: "Live JSON per round — full stats" },
    { key: "offline", label: "Offline", hint: "Kill-only from a .lwa export" },
  ];

  return (
    <div>
      <div className="flex overflow-hidden rounded border border-border-strong">
        {opts.map((o) => {
          const active = current === o.key;
          const tone = o.key === "offline" ? "bg-amber-500 text-bg" : "bg-sky-500 text-bg";
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => requestMode(o.key)}
              disabled={busy}
              aria-pressed={active}
              className={`flex-1 px-4 py-2.5 text-left transition-colors disabled:opacity-60 ${active ? tone : "bg-bg-elevated text-text-muted hover:text-text"}`}
            >
              <span className="block text-xs font-bold uppercase tracking-[0.12em]">{o.label}</span>
              <span className={`block text-[0.65rem] ${active ? "opacity-80" : "text-text-subtle"}`}>{o.hint}</span>
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <TotpGate
        open={pending !== null}
        action={pending === "online" ? "switch this game to online scoring" : "switch this game to offline scoring"}
        onCancel={() => setPending(null)}
        onVerified={applyMode}
      />
    </div>
  );
}
