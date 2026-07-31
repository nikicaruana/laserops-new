"use client";

/**
 * components/admin/SeasonEditor.tsx
 * --------------------------------------------------------------------
 * Create/edit a season (seasons table). is_active is derived from status.
 * season_number is the key challenges + standings reference. Writes via the
 * admin session (admin-write RLS).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export type SeasonRecord = {
  id: string;
  name: string | null;
  season_number: number | null;
  status: string | null; // upcoming | active | completed
  starts_on: string | null; // YYYY-MM-DD
  ends_on: string | null;
  terms_and_conditions: string | null;
};

const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";

export function SeasonEditor({
  season,
  mode = "edit",
}: {
  season: SeasonRecord;
  mode?: "edit" | "create";
}) {
  const router = useRouter();
  const isCreate = mode === "create";
  const [f, setF] = useState<SeasonRecord>(season);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof SeasonRecord>(k: K, v: SeasonRecord[K]) {
    setF((p) => ({ ...p, [k]: v }));
    setSaved(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!f.name || f.name.trim() === "") return setError("Name is required.");
    if (f.season_number === null || Number.isNaN(f.season_number))
      return setError("Season number is required.");
    setSaving(true);
    const supabase = createClient();
    const payload = {
      name: f.name.trim(),
      season_number: f.season_number,
      status: f.status || "upcoming",
      is_active: (f.status || "upcoming") === "active",
      starts_on: f.starts_on || null,
      ends_on: f.ends_on || null,
      terms_and_conditions: f.terms_and_conditions,
    };
    if (isCreate) {
      const { data, error: err } = await supabase.from("seasons").insert(payload).select("id").single();
      setSaving(false);
      if (err || !data) return setError(err?.message || "Couldn't create season.");
      router.push(`/admin/seasons/${data.id}`);
      return;
    }
    const { error: err } = await supabase.from("seasons").update(payload).eq("id", season.id);
    setSaving(false);
    if (err) return setError(err.message || "Couldn't save.");
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="max-w-2xl space-y-5">
      <fieldset className="border border-border bg-bg-elevated px-5 py-5">
        <legend className="px-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">
          Season
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={lbl}>Name</label>
            <input className={input} value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Season number</label>
            <input
              type="number"
              className={input}
              value={f.season_number ?? ""}
              onChange={(e) => set("season_number", e.target.value === "" ? null : Number(e.target.value))}
            />
          </div>
          <div>
            <label className={lbl}>Status</label>
            <select className={input} value={f.status ?? "upcoming"} onChange={(e) => set("status", e.target.value)}>
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div />
          <div>
            <label className={lbl}>Starts on</label>
            <input type="date" className={input} value={f.starts_on ?? ""} onChange={(e) => set("starts_on", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Ends on</label>
            <input type="date" className={input} value={f.ends_on ?? ""} onChange={(e) => set("ends_on", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Terms &amp; conditions</label>
            <textarea
              className={`${input} h-28 resize-y py-2`}
              value={f.terms_and_conditions ?? ""}
              onChange={(e) => set("terms_and_conditions", e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      {error && <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>}
      {saved && <p className="border border-accent bg-bg px-4 py-3 text-sm text-accent">Saved.</p>}

      <Button type="submit" size="md" disabled={saving}>
        {saving ? (isCreate ? "Creating…" : "Saving…") : isCreate ? "Create season" : "Save season"}
      </Button>
    </form>
  );
}
