"use client";

/**
 * components/admin/RecomputeResults.tsx
 * --------------------------------------------------------------------
 * "Results out of date" banner + recompute control. A scored match whose roster
 * changed (a player reassigned/added) has stale XP/Elo, because Elo depends on
 * who was in the match. Recompute (2FA) replays every scored match's XP/level/
 * Elo, rebuilds lifetime stats, and clears the flag.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TotpGate } from "@/components/admin/TotpGate";

export function RecomputeResults({ matchId, stale }: { matchId: string; stale: boolean }) {
  const router = useRouter();
  const [gate, setGate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function recompute() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/recompute`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; matches?: number; players?: number };
      if (!res.ok || !data.ok) setErr(data.error || "Recompute failed.");
      else { setMsg(`Recomputed ${data.players} players across ${data.matches} matches.`); router.refresh(); }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Recompute failed.");
    }
    setBusy(false);
  }

  return (
    <div
      className={`mb-8 px-5 py-4 ${
        stale
          ? "border-l-4 border border-l-amber-400 border-amber-600 bg-amber-950/40 shadow-[0_0_0_1px_rgba(251,191,36,0.25)]"
          : "border border-border bg-bg-elevated"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={`flex items-center gap-2 text-sm font-bold uppercase tracking-[0.1em] ${stale ? "text-amber-300" : "text-text-muted"}`}>
            {stale && <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />}
            {stale ? "Results out of date — recompute needed" : "Results up to date"}
            <HelpDot />
          </p>
          <p className="mt-1 max-w-xl text-xs text-text-muted">
            {stale
              ? "A player was changed after publishing. XP and ELO are recomputed across every scored match (ELO shifts when the line-up changes). Recompute when you're done editing."
              : "XP, levels and ELO reflect the current line-up. Recompute manually any time."}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => setGate(true)}
          className={`shrink-0 border px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] transition-transform active:scale-[0.98] disabled:opacity-50 ${
            stale ? "animate-pulse border-amber-400 bg-amber-400 text-bg" : "border-accent bg-accent text-bg"
          }`}
        >
          {busy ? "Recomputing…" : "Recompute XP & ELO"}
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-emerald-300">{msg}</p>}
      {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
      <TotpGate open={gate} action="recompute results" onCancel={() => setGate(false)} onVerified={async () => { setGate(false); await recompute(); }} />
    </div>
  );
}

/** A "?" help icon that reveals, on hover/focus, when to use Recompute XP & ELO. */
function HelpDot() {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="When to recompute XP & ELO"
        className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[0.6rem] font-bold leading-none text-text-muted transition-colors hover:text-accent focus:text-accent focus:outline-none"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-72 -translate-x-1/2 border border-border-strong bg-bg p-3 text-left text-[0.7rem] font-normal normal-case leading-relaxed tracking-normal text-text-muted shadow-lg group-hover:block group-focus-within:block"
      >
        <span className="mb-1 block font-bold uppercase tracking-[0.1em] text-text">Recompute XP &amp; ELO</span>
        Run this after you <span className="text-text">edit a player</span> on a scored match — reassign a headband to a profile, or set a gun. It replays XP, levels and ELO across every match (ELO changes when the line-up does) and refreshes the leaderboards. It does <span className="text-text">not</span> re-score the rounds. If the round files or scoring changed instead, use <span className="text-text">Re-publish scores</span> below.
      </span>
    </span>
  );
}
