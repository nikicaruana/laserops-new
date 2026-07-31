"use client";

/**
 * components/admin/TeamsManager.tsx
 * --------------------------------------------------------------------
 * Manage teams (teams table): badge, display name, colour, active, order.
 * colour is the identity matches reference (winning_team_colour), so it's the
 * key. Field/badge/order edits are held locally and persisted with Save
 * changes; add + delete apply immediately.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { AdminImageUploader } from "@/components/admin/AdminImageUploader";

export type TeamItem = {
  id: string;
  colour: string;
  display_name: string | null;
  badge_url: string | null;
  sort_order: number | null;
  is_active: boolean;
};

const input =
  "h-9 rounded-none border border-border-strong bg-bg px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";

export function TeamsManager({ initial }: { initial: TeamItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState<TeamItem[]>(initial);
  const [newColour, setNewColour] = useState("");
  const [newName, setNewName] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  function edit(id: string, patch: Partial<TeamItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    setDirty(true);
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const results = await Promise.all(
      items.map((t) =>
        supabase
          .from("teams")
          .update({
            colour: t.colour,
            display_name: t.display_name,
            badge_url: t.badge_url,
            sort_order: t.sort_order,
            is_active: t.is_active,
          })
          .eq("id", t.id),
      ),
    );
    setSaving(false);
    const err = results.find((r) => r.error)?.error;
    if (err) return setError(err.message || "Couldn't save.");
    setDirty(false);
    setSaved(true);
    router.refresh();
  }

  async function add() {
    const colour = newColour.trim();
    if (colour === "") return;
    if (items.some((i) => i.colour.toLowerCase() === colour.toLowerCase()))
      return setError(`Team "${colour}" already exists.`);
    setError(null);
    setBusy(true);
    const sort = Math.max(0, ...items.map((i) => i.sort_order ?? 0)) + 1;
    const { data, error: err } = await supabase
      .from("teams")
      .insert({ colour, display_name: newName.trim() || colour, is_active: true, sort_order: sort })
      .select("id, colour, display_name, badge_url, sort_order, is_active")
      .single();
    setBusy(false);
    if (err || !data) return setError(err?.message || "Couldn't add.");
    setItems([...items, data as TeamItem]);
    setNewColour("");
    setNewName("");
  }

  async function remove(id: string) {
    setBusy(true);
    const { error: err } = await supabase.from("teams").delete().eq("id", id);
    setBusy(false);
    if (err) return setError(err.message);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function move(it: TeamItem, dir: "up" | "down") {
    const idx = items.findIndex((i) => i.id === it.id);
    const j = dir === "up" ? idx - 1 : idx + 1;
    if (j < 0 || j >= items.length) return;
    const a = items[idx];
    const b = items[j];
    const aS = a.sort_order ?? idx;
    const bS = b.sort_order ?? j;
    setItems((prev) =>
      prev
        .map((i) => (i.id === a.id ? { ...a, sort_order: bS } : i.id === b.id ? { ...b, sort_order: aS } : i))
        .sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0)),
    );
    setDirty(true);
    setSaved(false);
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex items-center gap-4">
        <Button type="button" size="md" onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {dirty && <span className="text-xs text-text-subtle">Unsaved changes</span>}
        {saved && <span className="text-xs text-accent">Saved.</span>}
      </div>

      <ul className="mb-5 flex flex-col gap-3">
        {items.map((it, i) => (
          <li key={it.id} className="flex flex-wrap items-center gap-3 border border-border bg-bg-elevated px-4 py-3">
            <AdminImageUploader
              value={it.badge_url}
              onChange={(url) => edit(it.id, { badge_url: url })}
              kind="team"
              previewClass="h-12 w-12"
            />
            <div className="flex min-w-[8rem] flex-1 flex-col gap-2">
              <input
                value={it.display_name ?? ""}
                placeholder="Display name"
                onChange={(e) => edit(it.id, { display_name: e.target.value })}
                className={input}
              />
              <input
                value={it.colour}
                placeholder="Colour (identity)"
                onChange={(e) => edit(it.id, { colour: e.target.value })}
                className={`${input} font-mono`}
              />
            </div>
            <button
              type="button"
              onClick={() => edit(it.id, { is_active: !it.is_active })}
              className={`border px-2 py-1 text-[0.6rem] font-bold uppercase tracking-[0.1em] ${
                it.is_active ? "border-accent text-accent" : "border-border-strong text-text-subtle hover:text-accent"
              }`}
            >
              {it.is_active ? "Active" : "Inactive"}
            </button>
            <div className="flex">
              <button type="button" onClick={() => move(it, "up")} disabled={i === 0} className="flex h-8 w-7 items-center justify-center border border-border-strong text-text-muted hover:text-accent disabled:opacity-30" aria-label="Up">↑</button>
              <button type="button" onClick={() => move(it, "down")} disabled={i === items.length - 1} className="flex h-8 w-7 items-center justify-center border border-l-0 border-border-strong text-text-muted hover:text-accent disabled:opacity-30" aria-label="Down">↓</button>
            </div>
            <button type="button" onClick={() => remove(it.id)} disabled={busy} aria-label="Delete" className="flex h-8 w-7 items-center justify-center border border-red-900/60 text-red-400 hover:bg-red-950/40 disabled:opacity-30">✕</button>
          </li>
        ))}
        {items.length === 0 && <li className="text-xs text-text-subtle">No teams yet.</li>}
      </ul>

      <div className="flex flex-wrap gap-2">
        <input
          value={newColour}
          onChange={(e) => setNewColour(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="Colour (e.g. Green)"
          className={`${input} h-10 w-40`}
        />
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="Display name (optional)"
          className={`${input} h-10 min-w-[10rem] flex-1`}
        />
        <button
          type="button"
          onClick={add}
          disabled={busy || newColour.trim() === ""}
          className="h-10 border border-border-strong px-4 text-xs font-bold uppercase tracking-[0.12em] text-text-muted hover:border-accent hover:text-accent disabled:opacity-50"
        >
          + Add team
        </button>
      </div>

      {error && (
        <p className="mt-3 border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-400">{error}</p>
      )}
      <p className="mt-3 text-[0.65rem] text-text-subtle">
        Colour is the team identity matches are recorded against — rename with care. Add / delete
        apply immediately; other edits save with the button.
      </p>
    </div>
  );
}
