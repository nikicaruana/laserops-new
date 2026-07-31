"use client";

/**
 * components/admin/CreateMatchForm.tsx
 * --------------------------------------------------------------------
 * Admin creates an open game (a "slot"). Inserts a matches row as `tentative`
 * and open for signups; match_code + created_by are assigned by DB trigger.
 * Redirects to the match detail page to manage signups.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";
const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

export function CreateMatchForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [minPlayers, setMinPlayers] = useState("10");
  const [maxPlayers, setMaxPlayers] = useState("");
  const [priceEur, setPriceEur] = useState("");
  const [isDoubleXp, setIsDoubleXp] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!scheduledAt) {
      setError("Pick a date and time.");
      return;
    }
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) {
      setError("That date/time isn't valid.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("matches")
      .insert({
        title: title.trim() || null,
        scheduled_at: when.toISOString(),
        status: "tentative",
        min_players: Number(minPlayers) || 10,
        max_players: numOrNull(maxPlayers),
        price_eur: numOrNull(priceEur),
        is_double_xp: isDoubleXp,
        is_private: isPrivate,
      })
      .select("id")
      .single();
    setSaving(false);
    if (err || !data) {
      setError(err?.message || "Couldn't create the game.");
      return;
    }
    router.push(`/admin/matches/${data.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5">
      <fieldset className="border border-border bg-bg-elevated px-5 py-5">
        <legend className="px-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">
          Open game
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={lbl}>Title (optional)</label>
            <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Friday Night Open Game" />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Date &amp; time</label>
            <input
              type="datetime-local"
              className={input}
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
          <div>
            <label className={lbl}>Min players (quorum)</label>
            <input type="number" min="1" className={input} value={minPlayers} onChange={(e) => setMinPlayers(e.target.value)} onFocus={(e) => e.target.select()} />
            <p className="mt-1 text-[0.65rem] text-text-subtle">Confirms for admin sign-off once this many sign up.</p>
          </div>
          <div>
            <label className={lbl}>Max players (optional)</label>
            <input type="number" min="1" className={input} value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} onFocus={(e) => e.target.select()} placeholder="No cap" />
          </div>
          <div>
            <label className={lbl}>Price per player (EUR, optional)</label>
            <input type="number" step="0.01" min="0" className={input} value={priceEur} onChange={(e) => setPriceEur(e.target.value)} onFocus={(e) => e.target.select()} placeholder="e.g. 15" />
          </div>
          <div className="flex flex-col justify-end gap-2 pb-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text-muted">
              <input type="checkbox" className="h-4 w-4 accent-accent" checked={isDoubleXp} onChange={(e) => setIsDoubleXp(e.target.checked)} />
              Double XP
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text-muted">
              <input type="checkbox" className="h-4 w-4 accent-accent" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
              Private (not shown on the public games list)
            </label>
          </div>
        </div>
      </fieldset>

      {error && (
        <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      <Button type="submit" size="md" disabled={saving}>
        {saving ? "Creating…" : "Create open game"}
      </Button>
    </form>
  );
}
