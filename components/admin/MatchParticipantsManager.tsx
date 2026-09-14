"use client";

/**
 * components/admin/MatchParticipantsManager.tsx
 * --------------------------------------------------------------------
 * The single "Players & headbands" panel for a match. It merges what used to be
 * three separate sections (roster, identity resolution, edit players) into one:
 *   - The roster: every player in the match with their headband(s), gun and
 *     profile link. Rows come from live joins or are added by hand.
 *   - Headbands seen in the ingested file that aren't on the roster yet, shown
 *     with their in-game stats so an admin can add/link them in one click.
 *   - Works before AND after publishing (post-publish edits mark the results
 *     stale; re-publish to apply). Writes match_participants (admin_all RLS).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { AccountPicker, type PickedAccount } from "@/components/admin/AccountPicker";

const OPERATOR_ID = "00000000-0000-0000-0000-000000000001";

export type Participant = {
  id: string;
  account_id: string | null;
  headset_label: string | null;
  extra_headbands: string[] | null;
  gun_used: string | null;
  display_name: string | null;
  source: string | null;
  payment_intent: string | null;
  paid_at: string | null;
  account: { ops_tag: string | null; full_name: string | null } | null;
};

type EditRow = Participant & { extra: string[] };
type IngestInfo = { stat: string | null; team: string | null };

const cell =
  "h-10 w-full rounded-none border border-border-strong bg-bg px-2 text-sm text-text focus:border-accent focus:outline-none";
const hbInput =
  "h-10 w-16 rounded-none border border-border-strong bg-bg px-2 font-mono text-sm text-text focus:border-accent focus:outline-none";

export type ParticipantPayment = { intent: string | null; paid: boolean };

function payLabel(p: ParticipantPayment | undefined): { text: string; className: string } {
  if (!p) return { text: "No signup", className: "text-text-subtle" };
  if (p.paid) return { text: "Paid", className: "text-accent" };
  if (p.intent === "on_day") return { text: "On the day", className: "text-amber-300" };
  if (p.intent === "online") return { text: "Unpaid", className: "text-text-subtle" };
  return { text: "Not chosen", className: "text-text-subtle" };
}

const hbNumber = (s: string | null | undefined): number => {
  const m = String(s ?? "").match(/\d+/);
  return m ? parseInt(m[0], 10) : NaN;
};

export function MatchParticipantsManager({
  matchId,
  initial,
  guns,
  payments = {},
  ingest = {},
  published = false,
}: {
  matchId: string;
  initial: Participant[];
  guns: string[];
  payments?: Record<string, ParticipantPayment>;
  /** Headbands seen in the ingested file, keyed by number, with their stats. */
  ingest?: Record<number, IngestInfo>;
  published?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<EditRow[]>(
    initial.map((p) => ({ ...p, extra: [...(p.extra_headbands ?? [])] })),
  );
  const [newRow, setNewRow] = useState({ display_name: "", headset_label: "", gun_used: guns[0] ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkFor, setLinkFor] = useState<string | null>(null);
  const [uaGun, setUaGun] = useState<Record<number, string>>({});
  const [uaLinkFor, setUaLinkFor] = useState<number | null>(null);

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

  async function linkRow(id: string, account: PickedAccount) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("match_participants").update({ account_id: account.id }).eq("id", id);
    setBusy(false);
    setLinkFor(null);
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
      payment_intent: "on_day", // hand-added players are assumed paying on the day
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

  /** Add an unassigned file headband to the roster, optionally linked to an account. */
  async function addHeadband(headband: number, accountId: string | null) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("match_participants").insert({
      operator_id: OPERATOR_ID,
      match_id: matchId,
      headset_label: String(headband),
      gun_used: uaGun[headband] || null,
      account_id: accountId,
      source: "admin",
      payment_intent: accountId ? null : "on_day",
    });
    setBusy(false);
    setUaLinkFor(null);
    if (err) {
      return setError(
        err.message.includes("match_participants_match_id_headset_label_key")
          ? `Headband ${headband} is already on this match.`
          : err.message,
      );
    }
    router.refresh();
  }

  const gunSelect = (value: string, onChange: (v: string) => void) =>
    guns.length > 0 ? (
      <select className={cell} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">–</option>
        {guns.map((g) => (
          <option key={g} value={g}>{g}</option>
        ))}
      </select>
    ) : (
      <input className={cell} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Gun" />
    );

  // Which file headbands are already on the roster (primary + extras).
  const rosteredNums = new Set<number>();
  for (const r of rows) {
    for (const hb of [r.headset_label, ...r.extra]) {
      const n = hbNumber(hb);
      if (!Number.isNaN(n)) rosteredNums.add(n);
    }
  }
  const unassigned = Object.keys(ingest)
    .map(Number)
    .filter((n) => !rosteredNums.has(n))
    .sort((a, b) => a - b);

  const statOf = (headsetLabel: string | null) => {
    const n = hbNumber(headsetLabel);
    return Number.isNaN(n) ? null : ingest[n]?.stat ?? null;
  };

  return (
    <div className="space-y-4">
      {published && (
        <p className="border border-amber-500/40 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-200">
          This match is published. Changing a headband, profile or gun here marks the results stale &mdash; re-publish to apply it to the scores.
        </p>
      )}
      {error && (
        <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-elevated text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
              <th className="px-3 py-3 font-semibold">Player</th>
              <th className="px-3 py-3 font-semibold">Ops tag</th>
              <th className="px-3 py-3 font-semibold">Headband(s)</th>
              <th className="px-3 py-3 font-semibold">Gun</th>
              <th className="px-3 py-3 font-semibold">Stats</th>
              <th className="px-3 py-3 font-semibold">Payment</th>
              <th className="px-3 py-3 text-center font-semibold">Source</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const linked = Boolean(r.account_id);
              const name = r.account?.full_name || r.account?.ops_tag;
              const stat = statOf(r.headset_label);
              return (
                <tr key={r.id} className="border-b border-border align-middle last:border-0">
                  <td className="relative px-3 py-2">
                    {linked ? (
                      <span className="font-semibold text-text">{name ?? "Player"}</span>
                    ) : (
                      <div className="space-y-1">
                        <input
                          className={cell}
                          value={r.display_name ?? ""}
                          onChange={(e) => setField(r.id, "display_name", e.target.value)}
                          placeholder="Name"
                        />
                        <button
                          type="button"
                          onClick={() => setLinkFor(linkFor === r.id ? null : r.id)}
                          className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-text-subtle hover:text-accent"
                        >
                          {linkFor === r.id ? "Cancel" : "Link profile"}
                        </button>
                        {linkFor === r.id && (
                          <div className="absolute left-3 top-full z-20 mt-1">
                            <AccountPicker onPick={(a) => linkRow(r.id, a)} onCancel={() => setLinkFor(null)} />
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-text-muted">{r.account?.ops_tag ?? <span className="text-text-subtle">–</span>}</td>
                  <td className="px-3 py-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <input
                          className={hbInput}
                          value={r.headset_label ?? ""}
                          onChange={(e) => setField(r.id, "headset_label", e.target.value)}
                          placeholder="–"
                        />
                        <button
                          type="button"
                          onClick={() => addExtra(r.id)}
                          title="Add another headband (mid-game swap)"
                          className="flex h-8 w-8 shrink-0 items-center justify-center border border-border-strong text-text-muted hover:border-accent hover:text-accent"
                          aria-label="Add another headband"
                        >
                          +
                        </button>
                      </div>
                      {r.extra.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
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
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">{gunSelect(r.gun_used ?? "", (v) => setField(r.id, "gun_used", v))}</td>
                  <td className="px-3 py-2 font-mono text-[0.7rem] text-text-muted">{stat ?? <span className="text-text-subtle">–</span>}</td>
                  <td className="px-3 py-2 text-xs">
                    {(() => {
                      const own: ParticipantPayment | undefined =
                        r.payment_intent != null ? { intent: r.payment_intent, paid: Boolean(r.paid_at) } : undefined;
                      const pay = own ?? (r.account_id ? payments[r.account_id] : undefined);
                      if (!pay) return <span className="text-text-subtle">–</span>;
                      const l = payLabel(pay);
                      return <span className={l.className}>{l.text}</span>;
                    })()}
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
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-text-muted">
                  No players on this match yet. Assign headbands from the file below, add walk-ins by hand, or let signed-up players join live.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Headbands in the ingested file that aren't on the roster yet */}
      {unassigned.length > 0 && (
        <div className="overflow-x-auto border border-amber-500/40">
          <div className="border-b border-amber-500/40 bg-bg-elevated px-3 py-2.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-amber-300">
            Headbands in the file, not assigned yet ({unassigned.length})
          </div>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
                <th className="px-3 py-2.5 font-semibold">Headband</th>
                <th className="px-3 py-2.5 font-semibold">Team</th>
                <th className="px-3 py-2.5 font-semibold">Stats</th>
                <th className="px-3 py-2.5 font-semibold">Gun</th>
                <th className="px-3 py-2.5 text-right font-semibold">Assign</th>
              </tr>
            </thead>
            <tbody>
              {unassigned.map((n) => (
                <tr key={n} className="border-b border-border last:border-0 align-middle">
                  <td className="px-3 py-2 font-mono font-semibold text-accent">{n}</td>
                  <td className="px-3 py-2 text-xs text-text-muted">{ingest[n]?.team ?? <span className="text-text-subtle">–</span>}</td>
                  <td className="px-3 py-2 font-mono text-[0.7rem] text-text-muted">{ingest[n]?.stat ?? <span className="text-text-subtle">–</span>}</td>
                  <td className="px-3 py-2 w-40">{gunSelect(uaGun[n] ?? "", (v) => setUaGun((p) => ({ ...p, [n]: v })))}</td>
                  <td className="relative px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => addHeadband(n, null)}
                      disabled={busy}
                      className="mr-3 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-text-muted hover:text-accent disabled:opacity-50"
                    >
                      Add walk-in
                    </button>
                    <button
                      type="button"
                      onClick={() => setUaLinkFor(uaLinkFor === n ? null : n)}
                      disabled={busy}
                      className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-accent hover:text-accent-soft disabled:opacity-50"
                    >
                      {uaLinkFor === n ? "Cancel" : "Link profile"}
                    </button>
                    {uaLinkFor === n && (
                      <div className="absolute right-3 top-full z-20 mt-1">
                        <AccountPicker onPick={(a) => addHeadband(n, a.id)} onCancel={() => setUaLinkFor(null)} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add a player by hand (not in the file) */}
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
