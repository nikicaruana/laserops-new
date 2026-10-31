"use client";

/**
 * components/admin/RecipientPicker.tsx
 * --------------------------------------------------------------------
 * Pick one OR many players for a bulk admin action (token / XP-boost grants).
 * Two ways to add: search a player (AccountPicker), or pick a past game and pull
 * in everyone who played it. Selected players show as removable chips; the parent
 * owns the list. De-dupes by account id so the same player is never added twice.
 */
import { useState } from "react";
import { AccountPicker } from "@/components/admin/AccountPicker";
import { createClient } from "@/lib/supabase/client";

export type Recipient = { id: string; ops_tag: string };
export type MatchOption = { id: string; label: string };

const select =
  "h-11 w-full rounded-none border border-border-strong bg-bg-elevated px-3 text-sm text-text focus:border-accent focus:outline-none";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted";

export function RecipientPicker({
  value,
  onChange,
  matches,
}: {
  value: Recipient[];
  onChange: (next: Recipient[]) => void;
  matches: MatchOption[];
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function addOne(a: { id: string; ops_tag: string | null }) {
    setMsg(null);
    if (!value.some((r) => r.id === a.id)) onChange([...value, { id: a.id, ops_tag: a.ops_tag ?? "" }]);
  }
  function remove(id: string) {
    onChange(value.filter((r) => r.id !== id));
  }

  async function populateFromMatch(matchId: string) {
    setMsg(null);
    if (!matchId) return;
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("match_player_aggregate")
      .select("account_id, account:accounts!account_id(ops_tag)")
      .eq("match_id", matchId)
      .not("account_id", "is", null);
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    const existing = new Set(value.map((r) => r.id));
    const add: Recipient[] = [];
    for (const row of (data ?? []) as { account_id: string; account: { ops_tag: string | null } | { ops_tag: string | null }[] | null }[]) {
      if (existing.has(row.account_id) || add.some((a) => a.id === row.account_id)) continue;
      const acc = Array.isArray(row.account) ? row.account[0] : row.account;
      add.push({ id: row.account_id, ops_tag: acc?.ops_tag ?? "" });
    }
    onChange([...value, ...add]);
    setMsg(add.length ? `Added ${add.length} player${add.length === 1 ? "" : "s"} from that game.` : "No new players to add from that game.");
  }

  return (
    <div>
      <label className={labelCls}>Players{value.length > 0 ? ` (${value.length})` : ""}</label>

      {value.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {value.map((r) => (
            <span key={r.id} className="inline-flex items-center gap-2 border border-border-strong bg-bg px-2.5 py-1 text-xs">
              <span className="font-semibold text-accent">{r.ops_tag || "Player"}</span>
              <button type="button" onClick={() => remove(r.id)} className="text-text-subtle hover:text-red-400" aria-label={`Remove ${r.ops_tag || "player"}`}>
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => onChange([])}
            className="inline-flex items-center px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-text-subtle hover:text-red-400"
          >
            Clear all
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <AccountPicker onPick={addOne} autoFocus={false} className="w-full" />
          <p className="mt-1 text-[0.7rem] text-text-subtle">Search by ops tag, name or email to add a player.</p>
        </div>
        <div>
          <select
            className={select}
            defaultValue=""
            disabled={busy || matches.length === 0}
            onChange={(e) => {
              const id = e.target.value;
              e.target.value = ""; // reset so the same game can be re-picked
              void populateFromMatch(id);
            }}
          >
            <option value="">{busy ? "Loading players…" : "Add everyone from a game…"}</option>
            {matches.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[0.7rem] text-text-subtle">Pulls in every player who played that game.</p>
        </div>
      </div>
      {msg && <p className="mt-2 text-xs text-text-muted">{msg}</p>}
    </div>
  );
}
