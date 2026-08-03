"use client";

/**
 * components/admin/MatchParticipantsManager.tsx
 * --------------------------------------------------------------------
 * Admin roster for a match: who's playing, on which headband, with which gun.
 * Rows come from live joins (players) or are added by hand here (private
 * bookings / walk-ins). Admins can add, edit (headband / gun / name), and
 * remove entries. Writes match_participants directly (admin_all RLS).
 * Full headband-merge tooling is a later phase; this covers manual entry.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

const OPERATOR_ID = "00000000-0000-0000-0000-000000000001";

export type Participant = {
  id: string;
  account_id: string | null;
  headset_label: string | null;
  gun_used: string | null;
  display_name: string | null;
  source: string | null;
  account: { ops_tag: string | null; full_name: string | null } | null;
};

const cell =
  "h-10 w-full rounded-none border border-border-strong bg-bg px-2 text-sm text-text focus:border-accent focus:outline-none";

export function MatchParticipantsManager({
  matchId,
  initial,
  guns,
}: {
  matchId: string;
  initial: Participant[];
  guns: string[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Participant[]>(initial);
  const [newRow, setNewRow] = useState({ display_name: "", headset_label: "", gun_used: guns[0] ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(id: string, key: keyof Participant, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  }

  async function saveRow(row: Participant) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("match_participants")
      .update({
        headset_label: row.headset_label?.trim() || null,
        gun_used: row.gun_used?.trim() || null,
        display_name: row.display_name?.trim() || null,
      })
      .eq("id", row.id);
    setBusy(false);
    if (err) return setError(err.message);
    router.refresh();
  }

  async function removeRow(id: string) {
    if (!window.confirm("Remove this player from the match?")) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("match_participants").delete().eq("id", id);
    setBusy(false);
    if (err) return setError(err.message);
    setRows((prev) => prev.filter((r) => r.id !== id));
    router.refresh();
  }

  async function addRow() {
    if (!newRow.headset_label.trim() && !newRow.display_name.trim()) {
      setError("Enter at least a name or a headband.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("match_participants").insert({
      operator_id: OPERATOR_ID,
      match_id: matchId,
      headset_label: newRow.headset_label.trim() || null,
      gun_used: newRow.gun_used.trim() || null,
      display_name: newRow.display_name.trim() || null,
      source: "admin",
    });
    setBusy(false);
    if (err) return setError(err.message === "duplicate key value violates unique constraint \"match_participants_match_id_headset_label_key\"" ? "That headband is already on this match." : err.message);
    setNewRow({ display_name: "", headset_label: "", gun_used: guns[0] ?? "" });
    router.refresh();
  }

  const gunSelect = (value: string, onChange: (v: string) => void) =>
    guns.length > 0 ? (
      <select className={cell} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {guns.map((g) => (
          <option key={g} value={g}>{g}</option>
        ))}
      </select>
    ) : (
      <input className={cell} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Gun" />
    );

  return (
    <div className="space-y-4">
      {error && (
        <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-elevated text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
              <th className="px-3 py-3 font-semibold">Player</th>
              <th className="px-3 py-3 font-semibold">Headband</th>
              <th className="px-3 py-3 font-semibold">Gun</th>
              <th className="px-3 py-3 text-center font-semibold">Source</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const linked = Boolean(r.account_id);
              const name = r.account?.full_name || r.account?.ops_tag;
              return (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    {linked ? (
                      <span className="font-semibold text-text">{name ?? "Player"}</span>
                    ) : (
                      <input
                        className={cell}
                        value={r.display_name ?? ""}
                        onChange={(e) => setField(r.id, "display_name", e.target.value)}
                        placeholder="Name"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={`${cell} font-mono`}
                      value={r.headset_label ?? ""}
                      onChange={(e) => setField(r.id, "headset_label", e.target.value)}
                      placeholder="—"
                    />
                  </td>
                  <td className="px-3 py-2">{gunSelect(r.gun_used ?? "", (v) => setField(r.id, "gun_used", v))}</td>
                  <td className="px-3 py-2 text-center text-[0.6rem] uppercase tracking-[0.1em] text-text-subtle">
                    {r.source === "admin" ? "Added" : "Joined"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => saveRow(r)}
                      disabled={busy}
                      className="mr-3 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-accent hover:text-accent-soft disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(r.id)}
                      disabled={busy}
                      className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-text-subtle hover:text-red-400 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-text-muted">
                  No players on this match yet. Add them below or let signed-up players join live.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add a player */}
      <div className="border border-border bg-bg-elevated px-4 py-4">
        <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-accent">Add a player</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem_1fr_auto] sm:items-end">
          <div>
            <label className="mb-1 block text-[0.6rem] uppercase tracking-[0.12em] text-text-muted">Name</label>
            <input
              className={cell}
              value={newRow.display_name}
              onChange={(e) => setNewRow({ ...newRow, display_name: e.target.value })}
              placeholder="e.g. Birthday guest"
            />
          </div>
          <div>
            <label className="mb-1 block text-[0.6rem] uppercase tracking-[0.12em] text-text-muted">Headband</label>
            <input
              className={`${cell} font-mono`}
              value={newRow.headset_label}
              onChange={(e) => setNewRow({ ...newRow, headset_label: e.target.value })}
              placeholder="07"
            />
          </div>
          <div>
            <label className="mb-1 block text-[0.6rem] uppercase tracking-[0.12em] text-text-muted">Gun</label>
            {gunSelect(newRow.gun_used, (v) => setNewRow({ ...newRow, gun_used: v }))}
          </div>
          <Button type="button" size="md" onClick={addRow} disabled={busy}>
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
