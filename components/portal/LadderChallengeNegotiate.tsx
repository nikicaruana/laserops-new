"use client";

/**
 * components/portal/LadderChallengeNegotiate.tsx
 * --------------------------------------------------------------------
 * Respond to a ladder challenge. If it's your squad's turn: Accept (books the
 * match), Counter (propose a new date/time), or Decline. If you sent the current
 * proposal you can Cancel or wait. On accept the server returns the match id and
 * we jump to it.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

const input = "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";
const fmt = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const START = Array.from({ length: (1260 - 480) / 30 + 1 }, (_, i) => fmt(480 + i * 30));

export function LadderChallengeNegotiate({
  challengeId,
  canRespond,
  canCancel,
}: {
  challengeId: string;
  canRespond: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [countering, setCountering] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "accept" | "counter" | "decline" | "cancel") {
    setError(null);
    let scheduled: string | null = null;
    if (action === "counter") {
      if (!date || !time) return setError("Pick a new date and time.");
      const when = new Date(`${date}T${time}:00`);
      if (Number.isNaN(when.getTime())) return setError("That date and time isn't valid.");
      scheduled = when.toISOString();
    }
    setBusy(true);
    const supabase = createClient();
    const { data, error: err } = await supabase.rpc("respond_ladder_challenge", {
      p_challenge_id: challengeId,
      p_action: action,
      p_scheduled_at: scheduled,
    });
    setBusy(false);
    if (err) return setError(err.message);
    if (action === "accept" && data) return router.push(`/player-portal/games/${data}`);
    router.refresh();
  }

  if (!canRespond && !canCancel) {
    return <p className="text-sm text-text-muted">Waiting on the other squad to respond.</p>;
  }

  return (
    <div className="space-y-4">
      {error && <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>}
      {canRespond && !countering && (
        <div className="flex flex-wrap gap-3">
          <Button type="button" size="md" onClick={() => act("accept")} disabled={busy}>Accept &amp; book</Button>
          <Button type="button" size="md" variant="secondary" onClick={() => setCountering(true)} disabled={busy}>Propose another time</Button>
          <Button type="button" size="md" variant="ghost" onClick={() => act("decline")} disabled={busy}>Decline</Button>
        </div>
      )}
      {canRespond && countering && (
        <div className="max-w-lg space-y-4 portal-card px-5 py-5">
          <div>
            <label className={lbl}>New date</label>
            <input type="date" className={`${input} [color-scheme:dark]`} value={date} onChange={(e) => setDate(e.target.value)} onClick={(e) => e.currentTarget.showPicker?.()} />
          </div>
          <div>
            <label className={lbl}>New start time</label>
            <select className={input} value={time} onChange={(e) => setTime(e.target.value)}>
              <option value="">Select…</option>
              {START.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex gap-3">
            <Button type="button" size="sm" onClick={() => act("counter")} disabled={busy}>Send counter-proposal</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCountering(false)} disabled={busy}>Cancel</Button>
          </div>
        </div>
      )}
      {canCancel && (
        <button type="button" onClick={() => act("cancel")} disabled={busy} className="text-xs font-bold uppercase tracking-[0.12em] text-text-subtle hover:text-red-400 disabled:opacity-50">
          Withdraw challenge
        </button>
      )}
    </div>
  );
}
