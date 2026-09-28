"use client";

/**
 * components/admin/KillstreakEditor.tsx
 * --------------------------------------------------------------------
 * Details form for one killstreak definition (create or edit). A killstreak is
 * a streak-unlocked ability a player deploys from the live feed to jam the enemy
 * team's feed (Scrambler = one base, EMP = all bases). Writes
 * killstreak_definitions via the admin session (admin-write RLS). Gated (TOTP).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { AdminImageUploader } from "@/components/admin/AdminImageUploader";
import { TotpGate } from "@/components/admin/TotpGate";

export type KillstreakRecord = {
  id: string;
  key: string | null;
  name: string | null;
  description: string | null;
  icon: string | null;
  badge_url: string | null;
  scope: "one" | "all" | null;
  duration_seconds: number | null;
  unlock_streak_key: string | null;
  overlay_text: string | null;
  arm_instructions: string | null;
  sort_order: number | null;
  is_active: boolean | null;
};

export type StreakOption = { streak_key: string; name: string };

const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";

const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export function KillstreakEditor({
  killstreak,
  streakOptions,
  mode = "edit",
}: {
  killstreak: KillstreakRecord;
  streakOptions: StreakOption[];
  mode?: "edit" | "create";
}) {
  const router = useRouter();
  const isCreate = mode === "create";
  const [f, setF] = useState<KillstreakRecord>(killstreak);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  function set<K extends keyof KillstreakRecord>(key: K, value: KillstreakRecord[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }
  const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!f.name || f.name.trim() === "") return setError("Name is required.");
    if (!f.key || slug(f.key) === "") return setError("Key is required (lowercase slug, e.g. scrambler).");
    if (!f.duration_seconds || f.duration_seconds <= 0) return setError("Duration must be at least 1 second.");
    setGateOpen(true);
  }

  async function doSave() {
    setGateOpen(false);
    setSaving(true);
    const supabase = createClient();
    const payload = {
      key: slug(f.key ?? ""),
      name: (f.name ?? "").trim(),
      description: f.description,
      icon: (f.icon ?? "").trim() || null,
      badge_url: f.badge_url,
      scope: f.scope ?? "one",
      duration_seconds: f.duration_seconds ?? 30,
      unlock_streak_key: f.unlock_streak_key || null,
      overlay_text: (f.overlay_text ?? "").trim() || null,
      arm_instructions: (f.arm_instructions ?? "").trim() || null,
      sort_order: f.sort_order ?? 0,
      is_active: f.is_active ?? true,
    };

    if (isCreate) {
      const { data, error: err } = await supabase
        .from("killstreak_definitions")
        .insert(payload)
        .select("id")
        .single();
      setSaving(false);
      if (err || !data) return setError(err?.message || "Couldn't create killstreak.");
      router.push(`/admin/killstreaks/${data.id}`);
      return;
    }

    const { error: err } = await supabase
      .from("killstreak_definitions")
      .update(payload)
      .eq("id", killstreak.id);
    setSaving(false);
    if (err) return setError(err.message || "Couldn't save.");
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5">
      <fieldset className="border border-border bg-bg-elevated px-5 py-5">
        <legend className="px-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">
          Killstreak
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={lbl}>Thumbnail image</label>
            <AdminImageUploader
              value={f.badge_url}
              onChange={(url) => set("badge_url", url)}
              kind="killstreak"
              previewClass="h-20 w-20"
              expandable
            />
            <p className="mt-1 text-[0.65rem] text-text-subtle">Shown in the killstreak strip on the live feed and here in the admin list.</p>
          </div>

          <div>
            <label className={lbl}>Name</label>
            <input className={input} value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Scrambler" />
          </div>
          <div>
            <label className={lbl}>Key (slug)</label>
            <input className={input} value={f.key ?? ""} onChange={(e) => set("key", e.target.value)} placeholder="scrambler" />
          </div>

          <div>
            <label className={lbl}>Scope</label>
            <select className={input} value={f.scope ?? "one"} onChange={(e) => set("scope", e.target.value as "one" | "all")}>
              <option value="one">One base (player picks)</option>
              <option value="all">All bases</option>
            </select>
          </div>

          <div>
            <label className={lbl}>Duration (seconds)</label>
            <input type="number" min="1" max="600" className={input} value={f.duration_seconds ?? ""} onChange={(e) => set("duration_seconds", num(e.target.value))} onFocus={(e) => e.target.select()} />
          </div>
          <div>
            <label className={lbl}>Unlocked by streak</label>
            <select className={input} value={f.unlock_streak_key ?? ""} onChange={(e) => set("unlock_streak_key", e.target.value || null)}>
              <option value="">— none —</option>
              {streakOptions.map((s) => (
                <option key={s.streak_key} value={s.streak_key}>{s.name} ({s.streak_key})</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={lbl}>Description</label>
            <input className={input} value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} placeholder="What it does" />
          </div>

          <div className="sm:col-span-2">
            <label className={lbl}>Overlay text (over the jammed feed)</label>
            <input className={input} value={f.overlay_text ?? ""} onChange={(e) => set("overlay_text", e.target.value)} placeholder="{ops}'s Scrambler" />
            <p className="mt-1 text-[0.65rem] text-text-subtle">
              Use <code className="text-text-muted">{"{ops}"}</code> for the deployer's ops tag. Blank falls back to <code className="text-text-muted">{"{ops}'s {name}"}</code>.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className={lbl}>Arming instructions (shown when tapped)</label>
            <input className={input} value={f.arm_instructions ?? ""} onChange={(e) => set("arm_instructions", e.target.value)} placeholder="Choose base to scramble or tap here to cancel" />
          </div>

          <div>
            <label className={lbl}>Sort order</label>
            <input type="number" className={input} value={f.sort_order ?? ""} onChange={(e) => set("sort_order", num(e.target.value))} onFocus={(e) => e.target.select()} placeholder="0" />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text-muted">
              <input type="checkbox" className="h-4 w-4 accent-accent" checked={f.is_active ?? true} onChange={(e) => set("is_active", e.target.checked)} />
              Active
            </label>
          </div>
        </div>
      </fieldset>

      {error && <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>}
      {saved && <p className="border border-accent bg-bg px-4 py-3 text-sm text-accent">Saved.</p>}

      <Button type="submit" size="md" disabled={saving}>
        {saving ? (isCreate ? "Creating…" : "Saving…") : isCreate ? "Create killstreak" : "Save killstreak"}
      </Button>

      <TotpGate
        open={gateOpen}
        action={isCreate ? "the new killstreak" : "this killstreak change"}
        onCancel={() => setGateOpen(false)}
        onVerified={doSave}
      />
    </form>
  );
}
