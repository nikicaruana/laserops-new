"use client";

/**
 * components/admin/PublishScores.tsx
 * --------------------------------------------------------------------
 * The "make results official" commit control. Behind step-up 2FA (TotpGate),
 * it POSTs to /api/matches/[id]/publish, which computes per-player aggregates +
 * accolades + XP from the reviewed rounds and writes them. Blocked server-side
 * if any capture ambiguity is unreviewed.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TotpGate } from "@/components/admin/TotpGate";

export function PublishScores({ matchId, alreadyPublished }: { matchId: string; alreadyPublished: boolean }) {
  const router = useRouter();
  const [gate, setGate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function publish() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/publish`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; players?: number; awards?: number; winner?: string | null };
      if (!res.ok || !data.ok) setErr(data.error || "Publish failed.");
      else { setMsg(`Published — ${data.players} players, ${data.awards} accolades${data.winner ? `, winner ${data.winner}` : ""}.`); router.refresh(); }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Publish failed.");
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => setGate(true)}
        className="border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? "Publishing…" : alreadyPublished ? "Re-publish scores" : "Publish scores"}
      </button>
      {alreadyPublished && !msg && <span className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-emerald-300">✓ Scores published</span>}
      <span className="text-[0.65rem] text-text-subtle">Writes official per-player scores, accolades &amp; XP. Requires 2FA. Blocked until all capture ambiguities are reviewed.</span>
      {msg && <span className="w-full text-xs text-emerald-300">{msg}</span>}
      {err && <span className="w-full text-xs text-red-400">{err}</span>}
      <TotpGate open={gate} action="publish match scores" onCancel={() => setGate(false)} onVerified={async () => { setGate(false); await publish(); }} />
    </div>
  );
}
