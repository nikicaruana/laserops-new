"use client";

/**
 * components/admin/GunEditor.tsx
 * --------------------------------------------------------------------
 * Details form for one gun (everything except damage, which the
 * GunDamagePanel owns because it's effective-dated). Writes the guns row via
 * the admin's authenticated Supabase session — the guns_admin_write RLS
 * policy enforces is_admin().
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export type GunRecord = {
  id: string;
  name: string | null;
  image_url: string | null;
  class: string | null;
  tree_branch: string | null;
  is_default: boolean | null;
  is_visible: boolean | null;
  sort_order: number | null;
  unlock_type: string | null;
  unlock_prerequisite_class: string | null;
  unlock_prerequisite_gun: string | null;
  unlock_requirement_points: number | null;
  unlock_requirement_level: number | null;
  unlock_display_text: string | null;
  unlock_tier: string | null;
  mag_size: number | null;
  reload: number | null;
  fire_rate: string | null;
  difficulty: string | null;
  description: string | null;
  damage: number | null;
  length: number | null;
  weight: number | null;
  gun_range: number | null;
};

const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const label =
  "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";

function Field({
  label: lbl,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className={label}>{lbl}</label>
      {children}
      {hint && <p className="mt-1 text-[0.65rem] text-text-subtle">{hint}</p>}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border border-border bg-bg-elevated px-5 py-5">
      <legend className="px-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">
        {title}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function GunEditor({
  gun,
  mode = "edit",
}: {
  gun: GunRecord;
  mode?: "edit" | "create";
}) {
  const router = useRouter();
  const isCreate = mode === "create";
  const [f, setF] = useState<GunRecord>(gun);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof GunRecord>(key: K, value: GunRecord[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (isCreate && (!f.name || f.name.trim() === "")) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    // Fields common to create + edit. Damage is excluded from EDIT (managed in
    // the damage panel) but seeded on CREATE (the insert trigger opens the
    // first damage-history window from it).
    const base = {
      name: f.name,
      image_url: f.image_url,
      class: f.class,
      tree_branch: f.tree_branch,
      is_default: f.is_default ?? false,
      is_visible: f.is_visible ?? true,
      sort_order: f.sort_order,
      unlock_type: f.unlock_type,
      unlock_prerequisite_class: f.unlock_prerequisite_class,
      unlock_prerequisite_gun: f.unlock_prerequisite_gun,
      unlock_requirement_points: f.unlock_requirement_points,
      unlock_requirement_level: f.unlock_requirement_level,
      unlock_display_text: f.unlock_display_text,
      unlock_tier: f.unlock_tier,
      mag_size: f.mag_size,
      reload: f.reload,
      fire_rate: f.fire_rate,
      difficulty: f.difficulty,
      description: f.description,
    };

    if (isCreate) {
      const { data, error: err } = await supabase
        .from("guns")
        .insert({ ...base, damage: f.damage })
        .select("id")
        .single();
      setSaving(false);
      if (err || !data) {
        setError(err?.message || "Couldn't create gun.");
        return;
      }
      // Off to the full edit page (with the damage panel) for the new gun.
      router.push(`/admin/guns/${data.id}`);
      return;
    }

    const { error: err } = await supabase.from("guns").update(base).eq("id", gun.id);
    setSaving(false);
    if (err) {
      setError(err.message || "Couldn't save.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <Group title="Identity">
        <Field label="Name">
          <input className={input} value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Class" hint="e.g. AR, SMG, LMG, Sniper, DMR, Shotgun">
          <input className={input} value={f.class ?? ""} onChange={(e) => set("class", e.target.value)} />
        </Field>
        <Field label="Image URL">
          <input className={input} value={f.image_url ?? ""} onChange={(e) => set("image_url", e.target.value)} />
        </Field>
        <Field label="Tree branch">
          <input className={input} value={f.tree_branch ?? ""} onChange={(e) => set("tree_branch", e.target.value)} />
        </Field>
        <Field label="Sort order">
          <input type="number" className={input} value={f.sort_order ?? ""} onChange={(e) => set("sort_order", num(e.target.value))} />
        </Field>
        <div className="flex items-end gap-6">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-text-muted">
            <input type="checkbox" className="h-4 w-4 accent-accent" checked={f.is_visible ?? true} onChange={(e) => set("is_visible", e.target.checked)} />
            Visible
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-text-muted">
            <input type="checkbox" className="h-4 w-4 accent-accent" checked={f.is_default ?? false} onChange={(e) => set("is_default", e.target.checked)} />
            Default gun
          </label>
        </div>
      </Group>

      <Group title="Specs">
        {isCreate ? (
          <Field label="Initial damage" hint="Seeds the damage timeline (in effect since launch).">
            <input type="number" step="any" className={input} value={f.damage ?? ""} onChange={(e) => set("damage", num(e.target.value))} />
          </Field>
        ) : (
          <Field label="Damage" hint="Managed in the Damage panel →">
            <input className={`${input} opacity-60`} value={f.damage ?? "—"} disabled readOnly />
          </Field>
        )}
        <Field label="Mag size">
          <input type="number" className={input} value={f.mag_size ?? ""} onChange={(e) => set("mag_size", num(e.target.value))} />
        </Field>
        <Field label="Reload (seconds)">
          <input type="number" step="0.1" className={input} value={f.reload ?? ""} onChange={(e) => set("reload", num(e.target.value))} />
        </Field>
        <Field label="Fire rate" hint='RPM number (e.g. "725") or "Semi Auto"'>
          <input className={input} value={f.fire_rate ?? ""} onChange={(e) => set("fire_rate", e.target.value)} />
        </Field>
        <Field label="Difficulty">
          <input className={input} value={f.difficulty ?? ""} onChange={(e) => set("difficulty", e.target.value)} />
        </Field>
        <Field label="Unlock tier">
          <input className={input} value={f.unlock_tier ?? ""} onChange={(e) => set("unlock_tier", e.target.value)} />
        </Field>
      </Group>

      <Group title="Unlock rules">
        <Field label="Unlock type" hint="Default / Class / Gun">
          <select className={input} value={f.unlock_type ?? ""} onChange={(e) => set("unlock_type", e.target.value || null)}>
            <option value="">—</option>
            <option value="Default">Default</option>
            <option value="Class">Class</option>
            <option value="Gun">Gun</option>
          </select>
        </Field>
        <Field label="Unlock display text">
          <input className={input} value={f.unlock_display_text ?? ""} onChange={(e) => set("unlock_display_text", e.target.value)} />
        </Field>
        <Field label="Prerequisite class">
          <input className={input} value={f.unlock_prerequisite_class ?? ""} onChange={(e) => set("unlock_prerequisite_class", e.target.value)} />
        </Field>
        <Field label="Prerequisite gun">
          <input className={input} value={f.unlock_prerequisite_gun ?? ""} onChange={(e) => set("unlock_prerequisite_gun", e.target.value)} />
        </Field>
        <Field label="Requirement points">
          <input type="number" className={input} value={f.unlock_requirement_points ?? ""} onChange={(e) => set("unlock_requirement_points", num(e.target.value))} />
        </Field>
        <Field label="Requirement level">
          <input type="number" className={input} value={f.unlock_requirement_level ?? ""} onChange={(e) => set("unlock_requirement_level", num(e.target.value))} />
        </Field>
      </Group>

      <Group title="Description">
        <div className="sm:col-span-2">
          <textarea
            className={`${input} h-28 resize-y py-2`}
            value={f.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Long-form description shown in the weapon detail popup."
          />
        </div>
      </Group>

      {error && (
        <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>
      )}
      {saved && (
        <p className="border border-accent bg-bg px-4 py-3 text-sm text-accent">Saved.</p>
      )}

      <div className="flex items-center gap-4">
        <Button type="submit" size="md" disabled={saving}>
          {saving ? (isCreate ? "Creating…" : "Saving…") : isCreate ? "Create gun" : "Save gun"}
        </Button>
      </div>
    </form>
  );
}
