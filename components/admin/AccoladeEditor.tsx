"use client";

/**
 * components/admin/AccoladeEditor.tsx
 * --------------------------------------------------------------------
 * Details form for one accolade definition (create or edit). Writes the
 * accolade_definitions row via the admin session (admin-write RLS). Badge is
 * uploaded through the shared AdminImageUploader. XP drives the display tier
 * (100 = T1, 75 = T2, 50 = T3), shown live next to the field.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { AdminImageUploader } from "@/components/admin/AdminImageUploader";

export type AccoladeRecord = {
  id: string;
  name: string | null;
  description: string | null;
  badge_url: string | null;
  xp: number | null;
  points: number | null;
  scope: string | null; // 'match' | 'round'
  is_active: boolean | null;
};

const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";

function tierLabel(xp: number | null): string {
  if (xp === 100) return "Tier 1";
  if (xp === 75) return "Tier 2";
  if (xp === 50) return "Tier 3";
  return "Unrated";
}

export function AccoladeEditor({
  accolade,
  mode = "edit",
}: {
  accolade: AccoladeRecord;
  mode?: "edit" | "create";
}) {
  const router = useRouter();
  const isCreate = mode === "create";
  const [f, setF] = useState<AccoladeRecord>(accolade);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof AccoladeRecord>(key: K, value: AccoladeRecord[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }
  const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!f.name || f.name.trim() === "") {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const payload = {
      name: f.name.trim(),
      description: f.description,
      badge_url: f.badge_url,
      xp: f.xp ?? 0,
      points: f.points ?? 0,
      scope: f.scope || "match",
      is_active: f.is_active ?? true,
    };

    if (isCreate) {
      const { data, error: err } = await supabase
        .from("accolade_definitions")
        .insert(payload)
        .select("id")
        .single();
      setSaving(false);
      if (err || !data) {
        setError(err?.message || "Couldn't create accolade.");
        return;
      }
      router.push(`/admin/accolades/${data.id}`);
      return;
    }

    const { error: err } = await supabase
      .from("accolade_definitions")
      .update(payload)
      .eq("id", accolade.id);
    setSaving(false);
    if (err) {
      setError(err.message || "Couldn't save.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="max-w-2xl space-y-5">
      <fieldset className="border border-border bg-bg-elevated px-5 py-5">
        <legend className="px-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">
          Accolade
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={lbl}>Name</label>
            <input className={input} value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Scope</label>
            <select className={input} value={f.scope ?? "match"} onChange={(e) => set("scope", e.target.value)}>
              <option value="match">Match</option>
              <option value="round">Round</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={lbl}>Badge image</label>
            <AdminImageUploader
              value={f.badge_url}
              onChange={(url) => set("badge_url", url)}
              kind="accolade"
              previewClass="h-16 w-16"
            />
          </div>

          <div className="sm:col-span-2">
            <label className={lbl}>Description</label>
            <input
              className={input}
              value={f.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              placeholder="What it's awarded for, e.g. Most Kills"
            />
          </div>

          <div>
            <label className={lbl}>
              XP{" "}
              <span className="ml-1 font-normal text-text-subtle">· {tierLabel(f.xp)}</span>
            </label>
            <input type="number" className={input} value={f.xp ?? ""} onChange={(e) => set("xp", num(e.target.value))} placeholder="100 / 75 / 50" />
          </div>
          <div>
            <label className={lbl}>Points</label>
            <input type="number" className={input} value={f.points ?? ""} onChange={(e) => set("points", num(e.target.value))} />
          </div>

          <div className="sm:col-span-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text-muted">
              <input type="checkbox" className="h-4 w-4 accent-accent" checked={f.is_active ?? true} onChange={(e) => set("is_active", e.target.checked)} />
              Active (counts toward stats + shows in the Hall of Fame)
            </label>
          </div>
        </div>
      </fieldset>

      {error && (
        <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>
      )}
      {saved && (
        <p className="border border-accent bg-bg px-4 py-3 text-sm text-accent">Saved.</p>
      )}

      <Button type="submit" size="md" disabled={saving}>
        {saving ? (isCreate ? "Creating…" : "Saving…") : isCreate ? "Create accolade" : "Save accolade"}
      </Button>
    </form>
  );
}
