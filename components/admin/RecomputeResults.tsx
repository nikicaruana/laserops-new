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
    <div className={`mb-8 border px-5 py-4 ${stale ? "border-amber-600 bg-amber-950/30" : "border-border bg-bg-elevated"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={`text-sm font-bold uppercase tracking-[0.1em] ${stale ? "text-amber-300" : "text-text-muted"}`}>
            {stale ? "Results out of date" : "Results up to date"}
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
            stale ? "border-amber-500 bg-amber-500 text-bg" : "border-accent bg-accent text-bg"
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
