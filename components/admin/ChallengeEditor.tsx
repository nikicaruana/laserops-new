"use client";

/**
 * components/admin/ChallengeEditor.tsx
 * --------------------------------------------------------------------
 * Create/edit a challenge (challenges table) within a season. source_mode +
 * metric define how players are ranked; the standings engine recomputes from
 * these on refresh. Writes via the admin session (admin-write RLS).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export type ChallengeRecord = {
  id: string;
  season_number: number | null;
  challenge_number: number | null;
  challenge_name: string | null;
  description: string | null;
  prize: string | null;
  priority: number | null;
  source_mode: string | null;
  metric: string | null;
  tiebreak_1: string | null;
  tiebreak_2: string | null;
  top_n: number | null;
  prize_cutoff: number | null;
  threshold: number | null;
};

const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";

const SOURCE_MODES: { value: string; label: string; hint: string }[] = [
  { value: "period_summed", label: "Summed over season", hint: "Sum the metric across the season (e.g. total XP, total round wins)." },
  { value: "period_max", label: "Best month", hint: "Highest single-month value of the metric." },
  { value: "match_top", label: "Best match", hint: "Best single-match value of the metric." },
  { value: "gun_threshold_count", label: "Guns over threshold", hint: "How many guns reach the kill threshold over the season." },
];
const METRICS = ["XP_Total", "Rounds_Won", "Matches_Won", "Total_Points", "PlayerFragsCount", "Total_Kills", "Total_Damage"];

export function ChallengeEditor({
  challenge,
  mode = "edit",
}: {
  challenge: ChallengeRecord;
  mode?: "edit" | "create";
}) {
  const router = useRouter();
  const isCreate = mode === "create";
  const [f, setF] = useState<ChallengeRecord>(challenge);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof ChallengeRecord>(k: K, v: ChallengeRecord[K]) {
    setF((p) => ({ ...p, [k]: v }));
    setSaved(false);
  }
  const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (f.season_number === null) return setError("Season number is required.");
    if (f.challenge_number === null) return setError("Challenge number is required.");
    setSaving(true);
    const supabase = createClient();
    const payload = {
      season_number: f.season_number,
      challenge_number: f.challenge_number,
      challenge_name: f.challenge_name,
      description: f.description,
      prize: f.prize,
      priority: f.priority ?? 999,
      source_mode: f.source_mode || "period_summed",
      metric: f.metric,
      tiebreak_1: f.tiebreak_1,
      tiebreak_2: f.tiebreak_2,
      top_n: f.top_n ?? 50,
      prize_cutoff: f.prize_cutoff ?? 2,
      threshold: f.threshold,
    };
    if (isCreate) {
      const { data, error: err } = await supabase.from("challenges").insert(payload).select("id").single();
      setSaving(false);
      if (err || !data) return setError(err?.message || "Couldn't create challenge.");
      router.push(`/admin/challenges/${data.id}`);
      return;
    }
    const { error: err } = await supabase.from("challenges").update(payload).eq("id", challenge.id);
    setSaving(false);
    if (err) return setError(err.message || "Couldn't save.");
    setSaved(true);
    router.refresh();
  }

  const modeHint = SOURCE_MODES.find((m) => m.value === (f.source_mode ?? "period_summed"))?.hint;

  return (
    <form onSubmit={save} className="max-w-2xl space-y-5">
      <fieldset className="border border-border bg-bg-elevated px-5 py-5">
        <legend className="px-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">
          Challenge
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={lbl}>Season number</label>
            <input type="number" className={input} value={f.season_number ?? ""} onChange={(e) => set("season_number", num(e.target.value))} />
          </div>
          <div>
            <label className={lbl}>Challenge number</label>
            <input type="number" className={input} value={f.challenge_number ?? ""} onChange={(e) => set("challenge_number", num(e.target.value))} />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Name</label>
            <input className={input} value={f.challenge_name ?? ""} onChange={(e) => set("challenge_name", e.target.value)} placeholder="e.g. XP" />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Description</label>
            <input className={input} value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} placeholder="Shown to players, e.g. The 2 players with the most XP." />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Prize</label>
            <input className={input} value={f.prize ?? ""} onChange={(e) => set("prize", e.target.value)} placeholder="e.g. 1 free open game + merch" />
          </div>
        </div>
      </fieldset>

      <fieldset className="border border-border bg-bg-elevated px-5 py-5">
        <legend className="px-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">
          Ranking
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={lbl}>How players are ranked</label>
            <select className={input} value={f.source_mode ?? "period_summed"} onChange={(e) => set("source_mode", e.target.value)}>
              {SOURCE_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            {modeHint && <p className="mt-1 text-[0.65rem] text-text-subtle">{modeHint}</p>}
          </div>
          <div>
            <label className={lbl}>Metric</label>
            <input className={input} list="challenge-metrics" value={f.metric ?? ""} onChange={(e) => set("metric", e.target.value)} placeholder="e.g. XP_Total" />
            <datalist id="challenge-metrics">
              {METRICS.map((m) => <option key={m} value={m} />)}
            </datalist>
          </div>
          <div>
            <label className={lbl}>Priority</label>
            <input type="number" className={input} value={f.priority ?? ""} onChange={(e) => set("priority", num(e.target.value))} />
          </div>
          <div>
            <label className={lbl}>Threshold <span className="text-text-subtle">(guns-over-threshold only)</span></label>
            <input type="number" className={input} value={f.threshold ?? ""} onChange={(e) => set("threshold", num(e.target.value))} />
          </div>
          <div>
            <label className={lbl}>Prize cutoff (top N win)</label>
            <input type="number" className={input} value={f.prize_cutoff ?? ""} onChange={(e) => set("prize_cutoff", num(e.target.value))} />
          </div>
          <div>
            <label className={lbl}>Show top N</label>
            <input type="number" className={input} value={f.top_n ?? ""} onChange={(e) => set("top_n", num(e.target.value))} />
          </div>
          <div>
            <label className={lbl}>Tiebreak 1</label>
            <input className={input} value={f.tiebreak_1 ?? ""} onChange={(e) => set("tiebreak_1", e.target.value)} placeholder="e.g. round_win_rate_descending" />
          </div>
          <div>
            <label className={lbl}>Tiebreak 2</label>
            <input className={input} value={f.tiebreak_2 ?? ""} onChange={(e) => set("tiebreak_2", e.target.value)} />
          </div>
        </div>
      </fieldset>

      {error && <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>}
      {saved && <p className="border border-accent bg-bg px-4 py-3 text-sm text-accent">Saved.</p>}

      <Button type="submit" size="md" disabled={saving}>
        {saving ? (isCreate ? "Creating…" : "Saving…") : isCreate ? "Create challenge" : "Save challenge"}
      </Button>
    </form>
  );
}
