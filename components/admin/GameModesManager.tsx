"use client";

/**
 * components/admin/GameModesManager.tsx
 * --------------------------------------------------------------------
 * Manage game modes (scenarios): add, rename, set the default/fallback, delete.
 * The slug is generated once on add and is immutable (it keys the per-mode
 * score_formula). Exactly one mode is the default. Writes via the admin session.
 */
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ModeItem = {
  id: string;
  name: string;
  slug: string;
  is_default: boolean;
  sort_order: number | null;
};

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const input =
  "h-9 rounded-none border border-border-strong bg-bg px-3 text-sm text-text focus:border-accent focus:outline-none";

export function GameModesManager({ initial }: { initial: ModeItem[] }) {
  const [items, setItems] = useState<ModeItem[]>(initial);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const nameOf = (m: ModeItem) => drafts[m.id] ?? m.name;

  async function add() {
    const name = newName.trim();
    if (name === "") return;
    const slug = slugify(name);
    if (slug === "") return setError("Give the mode a name with letters or numbers.");
    if (items.some((m) => m.slug === slug)) return setError(`"${name}" already exists.`);
    setError(null);
    setBusy(true);
    const sort = Math.max(0, ...items.map((m) => m.sort_order ?? 0)) + 1;
    const { data, error: err } = await supabase
      .from("game_modes")
      .insert({ name, slug, is_default: items.length === 0, sort_order: sort })
      .select("id, name, slug, is_default, sort_order")
      .single();
    setBusy(false);
    if (err || !data) return setError(err?.message || "Couldn't add.");
    setItems([...items, data as ModeItem]);
    setNewName("");
  }

  async function saveName(m: ModeItem) {
    const name = (drafts[m.id] ?? m.name).trim();
    if (name === "" || name === m.name) {
      setDrafts((d) => {
        const n = { ...d };
        delete n[m.id];
        return n;
      });
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.from("game_modes").update({ name }).eq("id", m.id);
    setBusy(false);
    if (err) return setError(err.message);
    setItems(items.map((i) => (i.id === m.id ? { ...i, name } : i)));
    setDrafts((d) => {
      const n = { ...d };
      delete n[m.id];
      return n;
    });
  }

  async function setDefault(m: ModeItem) {
    if (m.is_default) return;
    setBusy(true);
    await supabase.from("game_modes").update({ is_default: false }).eq("is_default", true);
    const { error: err } = await supabase.from("game_modes").update({ is_default: true }).eq("id", m.id);
    setBusy(false);
    if (err) return setError(err.message);
    setItems(items.map((i) => ({ ...i, is_default: i.id === m.id })));
  }

  async function remove(m: ModeItem) {
    if (m.is_default) return setError("Set another mode as default before deleting this one.");
    if (items.length <= 1) return setError("Keep at least one mode.");
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.from("game_modes").delete().eq("id", m.id);
    setBusy(false);
    if (err) return setError(err.message);
    setItems(items.filter((i) => i.id !== m.id));
  }

  return (
    <div className="max-w-2xl">
      <ul className="mb-4 flex flex-col gap-2">
        {items.map((m) => (
          <li key={m.id} className="flex items-center gap-2 border border-border bg-bg-elevated px-3 py-2">
            <input
              value={nameOf(m)}
              onChange={(e) => setDrafts({ ...drafts, [m.id]: e.target.value })}
              onBlur={() => saveName(m)}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className={`${input} flex-1`}
            />
            <span className="hidden font-mono text-xs text-text-subtle sm:inline">{m.slug}</span>
            <button
              type="button"
              onClick={() => setDefault(m)}
              disabled={busy}
              className={`border px-2 py-1 text-[0.6rem] font-bold uppercase tracking-[0.1em] ${
                m.is_default
                  ? "border-accent text-accent"
                  : "border-border-strong text-text-subtle hover:border-accent hover:text-accent"
              }`}
            >
              {m.is_default ? "Default" : "Set default"}
            </button>
            <button
              type="button"
              onClick={() => remove(m)}
              disabled={busy || m.is_default}
              aria-label="Delete"
              className="flex h-7 w-7 shrink-0 items-center justify-center border border-red-900/60 text-red-400 hover:bg-red-950/40 disabled:opacity-30"
            >
              ✕
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="text-xs text-text-subtle">No modes yet.</li>}
      </ul>

      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add a mode… (e.g. Team Deathmatch)"
          className={`${input} h-10 flex-1`}
        />
        <button
          type="button"
          onClick={add}
          disabled={busy || newName.trim() === ""}
          className="h-10 border border-accent bg-accent px-4 text-xs font-bold uppercase tracking-[0.12em] text-bg disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {error && (
        <p className="mt-3 border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-400">{error}</p>
      )}
      <p className="mt-3 text-[0.65rem] text-text-subtle">
        The default mode is the fallback used for any game whose mode can&rsquo;t be identified at
        ingest. Deleting a mode leaves its saved formula orphaned but harmless.
      </p>
    </div>
  );
}
