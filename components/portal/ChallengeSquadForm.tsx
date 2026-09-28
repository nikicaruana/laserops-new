"use client";

/**
 * components/portal/ChallengeSquadForm.tsx
 * --------------------------------------------------------------------
 * Propose a squad-vs-squad match: pick which of your squads is challenging (if
 * you manage more than one), a date/time, and the team size. create_squad_challenge
 * RPC checks you captain/officer the home squad. Members are then notified.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";
const fmtMins = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const START_OPTIONS = Array.from({ length: (1260 - 480) / 30 + 1 }, (_, i) => fmtMins(480 + i * 30));

export function ChallengeSquadForm({
  awaySquadId,
  homeOptions,
}: {
  awaySquadId: string;
  homeOptions: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [homeId, setHomeId] = useState(homeOptions[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [teamSize, setTeamSize] = useState("5");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!homeId) return setError("Pick which squad is challenging.");
    if (!date || !startTime) return setError("Pick a date and start time.");
    const when = new Date(`${date}T${startTime}:00`);
    if (Number.isNaN(when.getTime())) return setError("That date and time isn't valid.");
    setSaving(true);
    const supabase = createClient();
    const { data, error: err } = await supabase.rpc("create_squad_challenge", {
      p_home_squad_id: homeId,
      p_away_squad_id: awaySquadId,
      p_scheduled_at: when.toISOString(),
      p_team_size: Number(teamSize) || 5,
    });
    setSaving(false);
    if (err || !data) return setError(err?.message || "Couldn't send the challenge.");
    router.push(`/player-portal/squad-matches/${data}`);
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5">
      <fieldset className="portal-card px-5 py-5">
        <legend className="px-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">Challenge</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {homeOptions.length > 1 && (
            <div className="sm:col-span-2">
              <label className={lbl}>Challenge on behalf of</label>
              <select className={input} value={homeId} onChange={(e) => setHomeId(e.target.value)}>
                {homeOptions.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="sm:col-span-2">
            <label className={lbl}>Date</label>
            <input type="date" className={`${input} [color-scheme:dark]`} value={date} onChange={(e) => setDate(e.target.value)} onClick={(e) => e.currentTarget.showPicker?.()} />
          </div>
          <div>
            <label className={lbl}>Start time</label>
            <select className={input} value={startTime} onChange={(e) => setStartTime(e.target.value)}>
              <option value="">Select…</option>
              {START_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>Players per side</label>
            <input type="number" min="1" className={input} value={teamSize} onChange={(e) => setTeamSize(e.target.value)} onFocus={(e) => e.target.select()} />
          </div>
        </div>
      </fieldset>

      {error && <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>}

      <div className="flex items-center gap-4">
        <Button type="submit" size="md" disabled={saving}>
          {saving ? "Sending…" : "Send challenge"}
        </Button>
        <p className="text-[0.65rem] text-text-subtle">Both squads&apos; members will be notified to sign up.</p>
      </div>
    </form>
  );
}
