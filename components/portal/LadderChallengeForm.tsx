"use client";

/**
 * components/portal/LadderChallengeForm.tsx
 * --------------------------------------------------------------------
 * Propose a ladder match against an opponent squad: date/time + team size
 * (default 6v6, more if both squads have the players). create_ladder_challenge
 * starts the negotiation; the opponent captain accepts or counters.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

const input = "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";
const fmt = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const START = Array.from({ length: (1260 - 480) / 30 + 1 }, (_, i) => fmt(480 + i * 30));

export function LadderChallengeForm({
  ladderKey,
  challengerSquadId,
  opponentSquadId,
}: {
  ladderKey: string;
  challengerSquadId: string;
  opponentSquadId: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [teamSize, setTeamSize] = useState("6");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!date || !time) return setError("Pick a date and time.");
    const when = new Date(`${date}T${time}:00`);
    if (Number.isNaN(when.getTime())) return setError("That date and time isn't valid.");
    setBusy(true);
    const supabase = createClient();
    const { data, error: err } = await supabase.rpc("create_ladder_challenge", {
      p_ladder_key: ladderKey,
      p_challenger_squad_id: challengerSquadId,
      p_opponent_squad_id: opponentSquadId,
      p_scheduled_at: when.toISOString(),
      p_team_size: Math.max(6, Number(teamSize) || 6),
    });
    setBusy(false);
    if (err || !data) return setError(err?.message || "Couldn't send the challenge.");
    router.push(`/player-portal/ladder-challenges/${data}`);
  }

  return (
    <form onSubmit={submit} className="max-w-lg space-y-4">
      <div>
        <label className={lbl}>Date</label>
        <input type="date" className={`${input} [color-scheme:dark]`} value={date} onChange={(e) => setDate(e.target.value)} onClick={(e) => e.currentTarget.showPicker?.()} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={lbl}>Start time</label>
          <select className={input} value={time} onChange={(e) => setTime(e.target.value)}>
            <option value="">Select…</option>
            {START.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Players per side</label>
          <input type="number" min="6" className={input} value={teamSize} onChange={(e) => setTeamSize(e.target.value)} onFocus={(e) => e.target.select()} />
          <p className="mt-1 text-[0.65rem] text-text-subtle">Default 6v6; more if both squads have the players.</p>
        </div>
      </div>
      {error && <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>}
      <Button type="submit" size="md" disabled={busy}>{busy ? "Sending…" : "Send challenge"}</Button>
    </form>
  );
}
