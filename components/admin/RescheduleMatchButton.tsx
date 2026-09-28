"use client";

/**
 * components/admin/RescheduleMatchButton.tsx
 * --------------------------------------------------------------------
 * Moves a planned game to a new date/time, keeping all its participants. Calls
 * reschedule_match (admin-gated), which notifies every signed-up player. Hidden
 * once a game is live/completed/cancelled (those can't be moved).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RescheduleMatchButton({ matchId, status, scheduledAt }: { matchId: string; status: string | null; scheduledAt: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState(toLocalInput(scheduledAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status && ["live", "completed", "cancelled"].includes(status)) return null;

  async function save() {
    if (!when) return setError("Pick a new date and time.");
    setBusy(true);
    setError(null);
    const iso = new Date(when).toISOString();
    try {
      const res = await fetch(`/api/matches/${matchId}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newScheduledAt: iso }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Couldn't reschedule.");
    } catch (err) {
      setBusy(false);
      return setError(err instanceof Error ? err.message : "Couldn't reschedule.");
    }
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setWhen(toLocalInput(scheduledAt)); setOpen(true); }}
        className="border border-border-strong px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-text-muted transition-colors hover:border-accent hover:text-accent"
      >
        Reschedule
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border border-border bg-bg-elevated px-4 py-3">
      <span className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-muted">New date / time</span>
      <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-9 border border-border-strong bg-bg px-2 text-sm text-text" />
      <Button type="button" size="sm" onClick={save} disabled={busy}>{busy ? "Moving…" : "Move game"}</Button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs font-bold uppercase tracking-[0.12em] text-text-subtle hover:text-accent">Cancel</button>
      {error && <span className="w-full text-xs text-red-400">{error}</span>}
    </div>
  );
}
