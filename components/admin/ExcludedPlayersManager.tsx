"use client";

/**
 * components/admin/ExcludedPlayersManager.tsx
 * --------------------------------------------------------------------
 * Manage the prize-ineligible list (excluded_players). Add nicknames, edit the
 * reason, toggle active/inactive (only active ones are excluded – toggling off
 * keeps the row for history), delete. Writes via the admin session.
 */
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ExcludedItem = {
  id: string;
  nickname: string;
  reason: string | null;
  status: string | null;
};

const input =
  "h-9 rounded-none border border-border-strong bg-bg px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";

export function ExcludedPlayersManager({ initial }: { initial: ExcludedItem[] }) {
  const [items, setItems] = useState<ExcludedItem[]>(initial);
  const [newNick, setNewNick] = useState("");
  const [newReason, setNewReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function add() {
    const nickname = newNick.trim();
    if (nickname === "") return;
    if (items.some((i) => i.nickname.toLowerCase() === nickname.toLowerCase()))
      return setError(`"${nickname}" is already listed.`);
    setError(null);
    setBusy(true);
    const { data, error: err } = await supabase
      .from("excluded_players")
      .insert({ nickname, reason: newReason.trim() || null, status: "active" })
      .select("id, nickname, reason, status")
      .single();
    setBusy(false);
    if (err || !data) return setError(err?.message || "Couldn't add.");
    setItems([...items, data as ExcludedItem]);
    setNewNick("");
    setNewReason("");
  }

  async function patch(id: string, patch: Partial<ExcludedItem>) {
    setBusy(true);
    const { error: err } = await supabase.from("excluded_players").update(patch).eq("id", id);
    setBusy(false);
    if (err) return setError(err.message);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function remove(id: string) {
    setBusy(true);
    const { error: err } = await supabase.from("excluded_players").delete().eq("id", id);
    setBusy(false);
    if (err) return setError(err.message);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="max-w-3xl">
      <ul className="mb-4 flex flex-col gap-2">
        {items.map((it) => {
          const active = (it.status ?? "").toLowerCase() === "active";
          return (
            <li key={it.id} className="flex flex-wrap items-center gap-2 border border-border bg-bg-elevated px-3 py-2">
              <input
                defaultValue={it.nickname}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== it.nickname) patch(it.id, { nickname: v });
                }}
                className={`${input} w-40`}
              />
              <input
                defaultValue={it.reason ?? ""}
                placeholder="Reason (optional)"
                onBlur={(e) => {
                  const v = e.target.value.trim() || null;
                  if (v !== (it.reason ?? null)) patch(it.id, { reason: v });
                }}
                className={`${input} min-w-[10rem] flex-1`}
              />
              <button
                type="button"
                onClick={() => patch(it.id, { status: active ? "inactive" : "active" })}
                disabled={busy}
                className={`border px-2 py-1 text-[0.6rem] font-bold uppercase tracking-[0.1em] ${
                  active ? "border-accent text-accent" : "border-border-strong text-text-subtle hover:text-accent"
                }`}
              >
                {active ? "Active" : "Inactive"}
              </button>
              <button
                type="button"
                onClick={() => remove(it.id)}
                disabled={busy}
                aria-label="Delete"
                className="flex h-7 w-7 shrink-0 items-center justify-center border border-red-900/60 text-red-400 hover:bg-red-950/40 disabled:opacity-30"
              >
                ✕
              </button>
            </li>
          );
        })}
        {items.length === 0 && <li className="text-xs text-text-subtle">No one excluded.</li>}
      </ul>

      <div className="flex flex-wrap gap-2">
        <input
          value={newNick}
          onChange={(e) => setNewNick(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="Ops tag / nickname"
          className={`${input} h-10 w-48`}
        />
        <input
          value={newReason}
          onChange={(e) => setNewReason(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="Reason (optional)"
          className={`${input} h-10 min-w-[10rem] flex-1`}
        />
        <button
          type="button"
          onClick={add}
          disabled={busy || newNick.trim() === ""}
          className="h-10 border border-accent bg-accent px-4 text-xs font-bold uppercase tracking-[0.12em] text-bg disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {error && (
        <p className="mt-3 border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-400">{error}</p>
      )}
      <p className="mt-3 text-[0.65rem] text-text-subtle">
        Only <span className="text-text-muted">active</span> entries are excluded from prize
        rankings (season challenges + homepage leaders). They still appear on the general
        leaderboards.
      </p>
    </div>
  );
}
