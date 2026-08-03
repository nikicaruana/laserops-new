"use client";

/**
 * components/admin/MatchParticipantsManager.tsx
 * --------------------------------------------------------------------
 * Admin roster for a match: who's playing, their ops tag, headband(s) and gun.
 * Rows come from live joins (players) or are added by hand (private bookings /
 * walk-ins). Each player can carry EXTRA headbands too — if a headband dies
 * mid-game and they're reissued another, ingestion merges the scores. Admins
 * add, edit, and remove entries. Writes match_participants (admin_all RLS).
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
  extra_headbands: string[] | null;
  gun_used: string | null;
  display_name: string | null;
  source: string | null;
  account: { ops_tag: string | null; full_name: string | null } | null;
};

type EditRow = Participant & { extra: string[] };

const cell =
  "h-10 w-full rounded-none border border-border-strong bg-bg px-2 text-sm text-text focus:border-accent focus:outline-none";

export type ParticipantPayment = { intent: string | null; paid: boolean };

function payLabel(p: ParticipantPayment | undefined): { text: string; className: string } {
  if (!p) return { text: "No signup", className: "text-text-subtle" };
  if (p.paid) return { text: "Paid", className: "text-accent" };
  if (p.intent === "on_day") return { text: "On the day", className: "text-amber-300" };
  if (p.intent === "online") return { text: "Unpaid", className: "text-text-subtle" };
  return { text: "Not chosen", className: "text-text-subtle" };
}

export function MatchParticipantsManager({
  matchId,
  initial,
  guns,
  payments = {},
}: {
  matchId: string;
  initial: Participant[];
  guns: string[];
  payments?: Record<string, ParticipantPayment>;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<EditRow[]>(
    initial.map((p) => ({ ...p, extra: [...(p.extra_headbands ?? [])] })),
  );
  const [newRow, setNewRow] = useState({ display_name: "", headset_label: "", gun_used: guns[0] ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(id: string, key: keyof EditRow, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  }
  function addExtra(id: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, extra: [...r.extra, ""] } : r)));
  }
  function setExtra(id: string, idx: number, value: string) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, extra: r.extra.map((x, i) => (i === idx ? value : x)) } : r)),
    );
  }
  function removeExtra(id: string, idx: number) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, extra: r.extra.filter((_, i) => i !== idx) } : r)));
  }

  async function saveRow(row: EditRow) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("match_participants")
      .update({
        headset_label: row.headset_label?.trim() || null,
        extra_headbands: row.extra.map((x) => x.trim()).filter(Boolean),
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
    if (err) {
      return setError(
        err.message.includes("match_participants_match_id_headset_label_key")
          ? "That headband is already on this match."
          : err.message,
      );
    }
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
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-elevated text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
              <th className="px-3 py-3 font-semibold">Player</th>
              <th className="px-3 py-3 font-semibold">Ops tag</th>
              <th className="px-3 py-3 font-semibold">Headband(s)</th>
              <th className="px-3 py-3 font-semibold">Gun</th>
              <th className="px-3 py-3 font-semibold">Payment</th>
              <th className="px-3 py-3 text-center font-semibold">Source</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const linked = Boolean(r.account_id);
              const name = r.account?.full_name || r.account?.ops_tag;
              return (
                <tr key={r.id} className="border-b border-border align-middle last:border-0">
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
                  <td className="px-3 py-2 font-mono text-xs text-text-muted">{r.account?.ops_tag ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input
                        className={`${cell} w-14 font-mono`}
                        value={r.headset_label ?? ""}
                        onChange={(e) => setField(r.id, "headset_label", e.target.value)}
                        placeholder="—"
                      />
                      {r.extra.map((x, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 border border-border-strong bg-bg pl-2">
                          <input
                            className="h-8 w-14 bg-transparent font-mono text-xs text-text focus:outline-none"
                            value={x}
                            onChange={(e) => setExtra(r.id, idx, e.target.value)}
                            placeholder="##"
                            autoFocus={x === ""}
                          />
                          <button
                            type="button"
                            onClick={() => removeExtra(r.id, idx)}
                            className="px-1.5 text-text-subtle hover:text-red-400"
                            aria-label="Remove headband"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={() => addExtra(r.id)}
                        title="Add another headband (mid-game swap)"
                        className="flex h-8 w-8 items-center justify-center border border-border-strong text-text-muted hover:border-accent hover:text-accent"
                        aria-label="Add another headband"
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2">{gunSelect(r.gun_used ?? "", (v) => setField(r.id, "gun_used", v))}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.account_id ? (
                      (() => {
                        const l = payLabel(payments[r.account_id]);
                        return <span className={l.className}>{l.text}</span>;
                      })()
                    ) : (
                      <span className="text-text-subtle">—</span>
                    )}
                  </td>
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
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-text-muted">
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
        <p className="mt-2 text-[0.65rem] text-text-subtle">
          Extra headbands (for a mid-game swap) can be added on the player&apos;s row after adding.
        </p>
      </div>
    </div>
  );
}
