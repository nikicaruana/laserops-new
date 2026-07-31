"use client";

/**
 * components/admin/TaxonomyList.tsx
 * --------------------------------------------------------------------
 * Editable list for a gun taxonomy table (gun_classes / gun_tree_branches):
 * add, rename, reorder, delete. Renaming cascades to the matching guns column
 * so existing guns stay consistent. All writes go through the admin session
 * (RLS admin-write). Local state is updated optimistically.
 */
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type TaxItem = { id: string; name: string; sort_order: number | null };

export function TaxonomyList({
  title,
  hint,
  table,
  gunColumn,
  initialItems,
}: {
  title: string;
  hint: string;
  table: "gun_classes" | "gun_tree_branches";
  gunColumn: "class" | "tree_branch";
  initialItems: TaxItem[];
}) {
  const [items, setItems] = useState<TaxItem[]>(initialItems);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const draftOf = (it: TaxItem) => drafts[it.id] ?? it.name;
  const clearDraft = (id: string) =>
    setDrafts((d) => {
      const n = { ...d };
      delete n[id];
      return n;
    });

  async function add() {
    const name = newName.trim();
    if (name === "") return;
    if (items.some((i) => i.name.toLowerCase() === name.toLowerCase())) {
      setError(`"${name}" already exists.`);
      return;
    }
    setError(null);
    setBusy(true);
    const sortOrder = Math.max(0, ...items.map((i) => i.sort_order ?? 0)) + 1;
    const { data, error: err } = await supabase
      .from(table)
      .insert({ name, sort_order: sortOrder })
      .select("id, name, sort_order")
      .single();
    setBusy(false);
    if (err || !data) {
      setError(err?.message || "Couldn't add.");
      return;
    }
    setItems([...items, data as TaxItem]);
    setNewName("");
  }

  async function saveName(it: TaxItem) {
    const val = (drafts[it.id] ?? it.name).trim();
    if (val === "" || val === it.name) {
      clearDraft(it.id);
      return;
    }
    if (items.some((i) => i.id !== it.id && i.name.toLowerCase() === val.toLowerCase())) {
      setError(`"${val}" already exists.`);
      return;
    }
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.from(table).update({ name: val }).eq("id", it.id);
    if (!err) {
      // Cascade to guns so existing weapons keep a valid value.
      await supabase.from("guns").update({ [gunColumn]: val }).eq(gunColumn, it.name);
    }
    setBusy(false);
    if (err) {
      setError(err.message || "Couldn't rename.");
      return;
    }
    setItems(items.map((i) => (i.id === it.id ? { ...i, name: val } : i)));
    clearDraft(it.id);
  }

  async function remove(it: TaxItem) {
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.from(table).delete().eq("id", it.id);
    setBusy(false);
    if (err) {
      setError(err.message || "Couldn't delete.");
      return;
    }
    setItems(items.filter((i) => i.id !== it.id));
  }

  async function move(it: TaxItem, dir: "up" | "down") {
    const idx = items.findIndex((i) => i.id === it.id);
    const j = dir === "up" ? idx - 1 : idx + 1;
    if (j < 0 || j >= items.length) return;
    const cur = items[idx];
    const nb = items[j];
    const curSort = cur.sort_order ?? idx;
    const nbSort = nb.sort_order ?? j;
    setError(null);
    setBusy(true);
    await supabase.from(table).update({ sort_order: nbSort }).eq("id", cur.id);
    const { error: err } = await supabase.from(table).update({ sort_order: curSort }).eq("id", nb.id);
    setBusy(false);
    if (err) {
      setError(err.message || "Couldn't reorder.");
      return;
    }
    const next = items.map((i) =>
      i.id === cur.id ? { ...cur, sort_order: nbSort } : i.id === nb.id ? { ...nb, sort_order: curSort } : i,
    );
    next.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    setItems(next);
  }

  return (
    <section className="border border-border bg-bg-elevated px-5 py-5">
      <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-accent">{title}</h2>
      <p className="mb-4 mt-1 text-xs text-text-muted">{hint}</p>

      <ul className="mb-4 flex flex-col gap-1.5">
        {items.map((it, i) => (
          <li key={it.id} className="flex items-center gap-2">
            <input
              value={draftOf(it)}
              onChange={(e) => setDrafts({ ...drafts, [it.id]: e.target.value })}
              onBlur={() => saveName(it)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="h-9 flex-1 rounded-none border border-border-strong bg-bg px-3 text-sm text-text focus:border-accent focus:outline-none"
            />
            <div className="flex shrink-0">
              <button type="button" onClick={() => move(it, "up")} disabled={i === 0 || busy} className="flex h-9 w-8 items-center justify-center border border-border-strong text-text-muted hover:text-accent disabled:opacity-30" aria-label="Move up">↑</button>
              <button type="button" onClick={() => move(it, "down")} disabled={i === items.length - 1 || busy} className="flex h-9 w-8 items-center justify-center border border-l-0 border-border-strong text-text-muted hover:text-accent disabled:opacity-30" aria-label="Move down">↓</button>
            </div>
            <button type="button" onClick={() => remove(it)} disabled={busy} className="flex h-9 w-8 shrink-0 items-center justify-center border border-red-900/60 text-red-400 hover:bg-red-950/40 disabled:opacity-30" aria-label="Delete">✕</button>
          </li>
        ))}
        {items.length === 0 && <li className="text-xs text-text-subtle">None yet.</li>}
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
          placeholder="Add new…"
          className="h-10 flex-1 rounded-none border border-border-strong bg-bg px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
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
        Renaming updates every gun using the old value. Deleting leaves those
        guns&rsquo; value as-is until you reassign them.
      </p>
    </section>
  );
}
