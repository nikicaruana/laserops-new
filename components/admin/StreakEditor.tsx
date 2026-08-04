"use client";

/**
 * components/admin/StreakEditor.tsx
 * --------------------------------------------------------------------
 * Details form for one streak definition (create or edit). Streaks are
 * event-level rewards that can fire multiple times per round (5-kill streak,
 * Clutch, First Blood, ...). Writes streak_definitions via the admin session
 * (admin-write RLS). Badge uploads through AdminImageUploader. Gated (TOTP).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { AdminImageUploader } from "@/components/admin/AdminImageUploader";
import { TotpGate } from "@/components/admin/TotpGate";

export type StreakRecord = {
  id: string;
  name: string | null;
  description: string | null;
  badge_url: string | null;
  xp: number | null;
  points: number | null;
  tier: number | null;
  is_active: boolean | null;
};

const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";

export function StreakEditor({
  streak,
  mode = "edit",
}: {
  streak: StreakRecord;
  mode?: "edit" | "create";
}) {
  const router = useRouter();
  const isCreate = mode === "create";
  const [f, setF] = useState<StreakRecord>(streak);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  function set<K extends keyof StreakRecord>(key: K, value: StreakRecord[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }
  const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!f.name || f.name.trim() === "") {
      setError("Name is required.");
      return;
    }
    setGateOpen(true);
  }

  async function doSave() {
    setGateOpen(false);
    setSaving(true);
    const supabase = createClient();
    const payload = {
      name: (f.name ?? "").trim(),
      description: f.description,
      badge_url: f.badge_url,
      xp: f.xp ?? 0,
      points: f.points ?? 0,
      tier: f.tier,
      is_active: f.is_active ?? true,
    };

    if (isCreate) {
      const { data, error: err } = await supabase
        .from("streak_definitions")
        .insert(payload)
        .select("id")
        .single();
      setSaving(false);
      if (err || !data) {
        setError(err?.message || "Couldn't create streak.");
        return;
      }
      router.push(`/admin/streaks/${data.id}`);
      return;
    }

    const { error: err } = await supabase
      .from("streak_definitions")
      .update(payload)
      .eq("id", streak.id);
    setSaving(false);
    if (err) {
      setError(err.message || "Couldn't save.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5">
      <fieldset className="border border-border bg-bg-elevated px-5 py-5">
        <legend className="px-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">
          Streak
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={lbl}>Name</label>
            <input className={input} value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Killing Spree" />
          </div>
          <div>
            <label className={lbl}>Points (each time it fires)</label>
            <input type="number" className={input} value={f.points ?? ""} onChange={(e) => set("points", num(e.target.value))} onFocus={(e) => e.target.select()} />
          </div>

          <div className="sm:col-span-2">
            <label className={lbl}>Badge image</label>
            <AdminImageUploader
              value={f.badge_url}
              onChange={(url) => set("badge_url", url)}
              kind="streak"
              previewClass="h-16 w-16"
            />
          </div>

          <div className="sm:col-span-2">
            <label className={lbl}>Description</label>
            <input
              className={input}
              value={f.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              placeholder="What earns it, e.g. 5 kills without dying"
            />
          </div>

          <div>
            <label className={lbl}>Tier</label>
            <input type="number" min="1" className={input} value={f.tier ?? ""} onChange={(e) => set("tier", num(e.target.value))} onFocus={(e) => e.target.select()} placeholder="1–4" />
          </div>
          <div>
            <label className={lbl}>XP (each time it fires)</label>
            <input type="number" className={input} value={f.xp ?? ""} onChange={(e) => set("xp", num(e.target.value))} onFocus={(e) => e.target.select()} />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text-muted">
              <input type="checkbox" className="h-4 w-4 accent-accent" checked={f.is_active ?? true} onChange={(e) => set("is_active", e.target.checked)} />
              Active
            </label>
          </div>
        </div>
      </fieldset>

      {error && (
        <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>
      )}
      {saved && <p className="border border-accent bg-bg px-4 py-3 text-sm text-accent">Saved.</p>}

      <Button type="submit" size="md" disabled={saving}>
        {saving ? (isCreate ? "Creating…" : "Saving…") : isCreate ? "Create streak" : "Save streak"}
      </Button>

      <TotpGate
        open={gateOpen}
        action={isCreate ? "the new streak" : "this streak change"}
        onCancel={() => setGateOpen(false)}
        onVerified={doSave}
      />
    </form>
  );
}
