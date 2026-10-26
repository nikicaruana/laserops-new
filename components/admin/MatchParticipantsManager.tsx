"use client";

/**
 * components/admin/MatchParticipantsManager.tsx
 * --------------------------------------------------------------------
 * The player-management panel for a match. It renders two collapsible
 * sub-sections that share one roster state (so edits in one are reflected
 * live in the other without a full reload):
 *   - "Players & payments" (top): per-player post-game settlement - mark a
 *     player paid (Cash / Revolut), add drinks for a walk-in who didn't
 *     self-report, see what they declared on the pay page (token + drinks),
 *     and undo a confirmation. Flat-rate bookings show an organiser note.
 *   - "Players & headbands": the roster - every player with their headband(s),
 *     gun and profile; file headbands not assigned yet; add walk-ins by hand.
 *     Works before AND after publishing (post-publish edits mark the results
 *     stale; re-publish to apply). Writes match_participants (admin_all RLS).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { AccountPicker, type PickedAccount } from "@/components/admin/AccountPicker";
import { Sensitive } from "@/components/admin/Sensitive";
import { Modal } from "@/components/ui/Modal";
import { CollapsibleSection } from "@/components/admin/CollapsibleSection";
import { formatEur } from "@/lib/money";

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
  paid_amount_eur: number | null;
  settlement_token_intent: number | null;
  drinks_total_eur: number | null;
  settlement_method: string | null;
  settled_declared_at: string | null;
  player_marked_paid_at: string | null;
  account: { ops_tag: string | null; full_name: string | null; email: string | null; discount_price_eur: number | null } | null;
};

type EditRow = Participant & { extra: string[] };
type IngestInfo = { stat: string | null; team: string | null };
type DrinkMenuItem = { id: string; name: string; price_eur: number };

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

const fmtTok = (n: number) => (Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(2))));

export function MatchParticipantsManager({
  matchId,
  initial,
  guns,
  drinks = [],
  payments = {},
  ingest = {},
  published = false,
  perPlayer = true,
  priceEur = null,
  tokenBalances = {},
}: {
  matchId: string;
  initial: Participant[];
  guns: string[];
  drinks?: DrinkMenuItem[];
  payments?: Record<string, ParticipantPayment>;
  /** Headbands seen in the ingested file, keyed by number, with their stats. */
  ingest?: Record<number, IngestInfo>;
  published?: boolean;
  perPlayer?: boolean;
  /** Per-player game price for this match (overridden by a player's family & friends price). */
  priceEur?: number | null;
  /** Current game-token balance per account_id (for the Tokens column). */
  tokenBalances?: Record<string, number>;
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
  const [paySel, setPaySel] = useState<Record<string, string>>({});
  const [feeInput, setFeeInput] = useState<Record<string, string>>({});
  const [drinksInput, setDrinksInput] = useState<Record<string, string>>({});
  const [drinkFor, setDrinkFor] = useState<EditRow | null>(null);
  const [drinkQty, setDrinkQty] = useState<Record<string, number>>({});

  // Settlement figures for a row: net game fee after any token, declared drinks, owed.
  const feeFor = (r: EditRow) => Number(r.account?.discount_price_eur ?? priceEur ?? 0);
  const tokenFor = (r: EditRow) => Number(r.settlement_token_intent ?? 0);
  const netGameFor = (r: EditRow) => Math.round(feeFor(r) * (1 - tokenFor(r)) * 100) / 100;
  const drinksStored = (r: EditRow) => Number(r.drinks_total_eur ?? 0);
  const drinksShown = (r: EditRow) => (drinksInput[r.id] !== undefined ? Number(drinksInput[r.id] || 0) : drinksStored(r));
  const owedFor = (r: EditRow) => Math.round((netGameFor(r) + drinksShown(r)) * 100) / 100;

  async function markPaid(r: EditRow, method: string) {
    if (!r.account_id) { setError("Link this player to a profile first."); return; }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    // Only override when the admin actually edited an input; otherwise let the RPC
    // use the computed game fee (and keep any itemised drinks).
    const amountOverride = feeInput[r.id] !== undefined ? Number(feeInput[r.id] || 0) : null;
    const drinksOverride = drinksInput[r.id] !== undefined ? Number(drinksInput[r.id] || 0) : null;
    const { error: err } = await supabase.rpc("admin_confirm_settlement", { p_match_id: matchId, p_account_id: r.account_id, p_method: method, p_amount_override: amountOverride, p_drinks_override: drinksOverride });
    setBusy(false);
    if (err) return setError(err.message);
    // Optimistically reflect the amount the RPC just recorded (game fee + drinks),
    // so the Paid column shows it immediately instead of 0 until the next refresh.
    const paidGame = amountOverride != null ? amountOverride : netGameFor(r);
    const paidDrinks = drinksOverride != null ? drinksOverride : drinksStored(r);
    const paidAmount = Math.round((paidGame + paidDrinks) * 100) / 100;
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, paid_at: new Date().toISOString(), paid_amount_eur: paidAmount, payment_intent: "on_day", settlement_method: method, drinks_total_eur: drinksOverride != null ? drinksOverride : x.drinks_total_eur } : x)));
    router.refresh();
  }
  async function undoPaid(r: EditRow) {
    if (!r.account_id) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("admin_unconfirm_settlement", { p_match_id: matchId, p_account_id: r.account_id });
    setBusy(false);
    if (err) return setError(err.message);
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, paid_at: null, paid_amount_eur: null } : x)));
    router.refresh();
  }

  // Open the drinks editor for a player, prefilled with their current orders.
  async function openDrinks(r: EditRow) {
    if (!r.account_id) { setError("Link this player to a profile first."); return; }
    setError(null);
    const supabase = createClient();
    const { data } = await supabase
      .from("match_drink_orders")
      .select("drink_id, qty")
      .eq("match_id", matchId)
      .eq("account_id", r.account_id);
    const seed: Record<string, number> = {};
    for (const d of data ?? []) if (d.drink_id) seed[d.drink_id as string] = Number(d.qty);
    setDrinkQty(seed);
    setDrinkFor(r);
  }
  async function saveDrinks() {
    const r = drinkFor;
    if (!r || !r.account_id) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const payload = drinks.map((d) => ({ drink_id: d.id, qty: drinkQty[d.id] ?? 0 })).filter((x) => x.qty > 0);
    const { data, error: err } = await supabase.rpc("admin_set_participant_drinks", { p_match_id: matchId, p_account_id: r.account_id, p_drinks: payload });
    setBusy(false);
    if (err) return setError(err.message);
    const total = Number((data as { drinksTotal?: number } | null)?.drinksTotal ?? 0);
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, drinks_total_eur: total, settled_declared_at: x.settled_declared_at ?? new Date().toISOString() } : x)));
    setDrinkFor(null);
    router.refresh();
  }

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
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, account_id: account.id, account: { ops_tag: account.ops_tag, full_name: account.full_name, email: null, discount_price_eur: null } } : r)),
    );
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
    const { data: inserted, error: err } = await supabase
      .from("match_participants")
      .insert({
        operator_id: OPERATOR_ID,
        match_id: matchId,
        headset_label: newRow.headset_label.trim() || null,
        gun_used: newRow.gun_used.trim() || null,
        display_name: newRow.display_name.trim() || null,
        source: "admin",
        payment_intent: "on_day", // hand-added players are assumed paying on the day
      })
      .select("id, account_id, headset_label, extra_headbands, gun_used, display_name, source, payment_intent, paid_at")
      .single();
    setBusy(false);
    if (err) {
      return setError(
        err.message.includes("match_participants_match_id_headset_label_key")
          ? "That headband is already on this match."
          : err.message,
      );
    }
    if (inserted) {
      const p = inserted as Participant;
      setRows((prev) => [...prev, { ...p, account: null, extra: [...(p.extra_headbands ?? [])] }]);
    }
    setNewRow({ display_name: "", headset_label: "", gun_used: guns[0] ?? "" });
    router.refresh();
  }

  /** Add an unassigned file headband to the roster, optionally linked to an account. */
  async function addHeadband(headband: number, account: PickedAccount | null) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: inserted, error: err } = await supabase
      .from("match_participants")
      .insert({
        operator_id: OPERATOR_ID,
        match_id: matchId,
        headset_label: String(headband),
        gun_used: uaGun[headband] || null,
        account_id: account?.id ?? null,
        source: "admin",
        payment_intent: account ? null : "on_day",
      })
      .select("id, account_id, headset_label, extra_headbands, gun_used, display_name, source, payment_intent, paid_at")
      .single();
    setBusy(false);
    setUaLinkFor(null);
    if (err) {
      return setError(
        err.message.includes("match_participants_match_id_headset_label_key")
          ? `Headband ${headband} is already on this match.`
          : err.message,
      );
    }
    if (inserted) {
      const p = inserted as Participant;
      setRows((prev) => [
        ...prev,
        { ...p, account: account ? { ops_tag: account.ops_tag, full_name: account.full_name, email: null, discount_price_eur: null } : null, extra: [...(p.extra_headbands ?? [])] },
      ]);
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

  // Payment-status cell for a single player (shared shape with the pay page).
  const paymentStatus = (r: EditRow) =>
    r.paid_at ? (
      <span className="font-semibold text-accent">
        Paid{r.paid_amount_eur != null ? ` ${formatEur(Number(r.paid_amount_eur))}` : ""}
        {r.settlement_method ? ` · ${r.settlement_method}` : ""}
      </span>
    ) : r.settled_declared_at ? (
      <span className={`text-xs leading-tight ${r.player_marked_paid_at ? "text-emerald-300" : "text-amber-300"}`}>
        {Number(r.drinks_total_eur) > 0 ? `Drinks ${formatEur(Number(r.drinks_total_eur))} · ` : ""}
        {r.player_marked_paid_at ? "player says paid" : "awaiting"}{r.settlement_method ? ` (${r.settlement_method})` : ""}
      </span>
    ) : (
      <span className="text-xs text-text-subtle">Unpaid</span>
    );

  const payable = rows.filter((r) => r.account_id);
  const owing = payable.filter((r) => !r.paid_at).length;
  const drinksTotalPreview = drinks.reduce((s, d) => s + Number(d.price_eur) * (drinkQty[d.id] ?? 0), 0);

  return (
    <>
      {error && (
        <p className="mb-4 border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      {/* ----- Players & payments ----------------------------------------- */}
      <CollapsibleSection
        defaultOpen={false}
        title="Players & payments"
        count={perPlayer ? owing : undefined}
        subtitle={
          perPlayer
            ? "Settle each player after the game. A token they used on the pay page is already applied; add any drinks they had, then mark the cash/Revolut part paid. Count shows how many still owe."
            : "This is a flat-rate booking - the organiser settles the whole total. No per-player payments are tracked here."
        }
      >
        {!perPlayer ? (
          <p className="border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">
            Organiser pays. Record the booking total manually in the financial tracker.
          </p>
        ) : (
          <div className="overflow-x-auto border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-elevated text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
                  <th className="px-3 py-3 font-semibold">Player</th>
                  <th className="px-3 py-3 font-semibold">Declared</th>
                  <th className="px-2 py-3 text-center font-semibold">Tokens</th>
                  <th className="px-2 py-3 text-center font-semibold">Used</th>
                  <th className="px-3 py-3 text-right font-semibold">Owed</th>
                  <th className="px-3 py-3 text-right font-semibold">Settle</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const name = r.account?.full_name || r.account?.ops_tag || r.display_name;
                  const bal = r.account_id ? Number(tokenBalances[r.account_id] ?? 0) : 0;
                  const usedTok = tokenFor(r);
                  return (
                    <tr key={r.id} className="border-b border-border align-top last:border-0">
                      {/* Player: name + ops-tag chip + email (shared with Payments Due) */}
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          <span>
                            {r.account?.full_name
                              ? <Sensitive className="font-semibold text-text">{r.account.full_name}</Sensitive>
                              : <span className="font-semibold text-text">{name ?? "Player"}</span>}
                            {r.account?.ops_tag && <span className="ml-2 font-mono text-[0.7rem] text-text-subtle">{r.account.ops_tag}</span>}
                          </span>
                          {r.account?.email && (
                            <a href={`mailto:${r.account.email}`} className="text-[0.7rem] text-text-subtle underline hover:text-accent"><Sensitive>{r.account.email}</Sensitive></a>
                          )}
                        </div>
                      </td>
                      {/* Declared: what the player said on the pay page */}
                      <td className="px-3 py-2.5">
                        {r.account_id ? paymentStatus(r) : <span className="text-xs text-text-subtle">Not a member</span>}
                      </td>
                      {/* Tokens: balance; before -> after when one was used; flag unused */}
                      <td className="px-2 py-2.5 text-center text-xs whitespace-nowrap">
                        {!r.account_id ? <span className="text-text-subtle">–</span>
                          : usedTok > 0 ? <span className="font-semibold text-accent" title="Token used this game (before → after)">{fmtTok(bal + usedTok)} → {fmtTok(bal)}</span>
                          : <span className={bal > 0 ? "font-semibold text-amber-300" : "text-text-subtle"} title={bal > 0 ? "Has tokens but didn't use one" : undefined}>{fmtTok(bal)}</span>}
                      </td>
                      {/* Token used: tick when one was applied */}
                      <td className="px-2 py-2.5 text-center">
                        {usedTok > 0 ? <span className="text-accent" title="Token used">✓</span> : <span className="text-text-subtle/40">·</span>}
                      </td>
                      {/* Owed: net game fee after token + drinks */}
                      <td className="px-3 py-2.5 text-right font-semibold text-text">
                        {r.account_id ? formatEur(owedFor(r)) : <span className="text-text-subtle">–</span>}
                      </td>
                      {/* Settle */}
                      <td className="px-3 py-2.5 text-right">
                        {!r.account_id ? (
                          <span className="text-[0.65rem] text-text-subtle">Link a profile in the roster below to settle</span>
                        ) : r.paid_at ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[0.7rem] text-accent">Paid {formatEur(Number(r.paid_amount_eur ?? 0))} · {r.settlement_method ?? "cash"}</span>
                            <button type="button" onClick={() => undoPaid(r)} disabled={busy} className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-text-subtle hover:text-red-400 disabled:opacity-50">Undo</button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center justify-end gap-2">
                              <div className="flex flex-col gap-0.5">
                                <label className="flex items-center justify-end gap-1 text-[0.55rem] uppercase tracking-[0.08em] text-text-subtle">Game €
                                  <input type="number" step="0.01" min="0" value={feeInput[r.id] ?? String(netGameFor(r))} onChange={(e) => setFeeInput((s) => ({ ...s, [r.id]: e.target.value }))} className="h-6 w-16 rounded-none border border-border-strong bg-bg px-1.5 text-xs text-text focus:border-accent focus:outline-none" /></label>
                                <label className="flex items-center justify-end gap-1 text-[0.55rem] uppercase tracking-[0.08em] text-text-subtle">Drinks €
                                  <input type="number" step="0.01" min="0" placeholder="0" value={drinksInput[r.id] ?? (drinksStored(r) > 0 ? String(drinksStored(r)) : "")} onChange={(e) => setDrinksInput((s) => ({ ...s, [r.id]: e.target.value }))} className="h-6 w-16 rounded-none border border-border-strong bg-bg px-1.5 text-xs text-text focus:border-accent focus:outline-none" /></label>
                              </div>
                              <select className="h-7 rounded-none border border-border-strong bg-bg px-1.5 text-xs text-text focus:border-accent focus:outline-none" value={paySel[r.id] ?? r.settlement_method ?? "cash"} onChange={(e) => setPaySel((s) => ({ ...s, [r.id]: e.target.value }))}>
                                <option value="cash">Cash</option>
                                <option value="revolut">Revolut</option>
                              </select>
                              <button type="button" onClick={() => markPaid(r, paySel[r.id] ?? r.settlement_method ?? "cash")} disabled={busy} className="whitespace-nowrap border border-accent bg-accent/10 px-3 py-1.5 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-accent hover:bg-accent/20 disabled:opacity-50">Mark paid</button>
                            </div>
                            <button type="button" onClick={() => openDrinks(r)} disabled={busy} className="text-[0.55rem] uppercase tracking-[0.1em] text-text-subtle hover:text-accent disabled:opacity-50">Itemise drinks</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-sm text-text-muted">
                      No players on this match yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleSection>

      {/* ----- Players & headbands ---------------------------------------- */}
      <CollapsibleSection
        defaultOpen={false}
        title="Players & headbands"
        count={rows.length}
        subtitle="Everyone in the match with their headband, gun and profile. Assign the headbands the game file saw, add walk-ins by hand, or let signed-up players join live. Editing after publishing marks results stale &ndash; re-publish to apply."
      >
        <div className="space-y-4">
          {published && (
            <p className="border border-amber-500/40 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-200">
              This match is published. Changing a headband, profile or gun here marks the results stale &mdash; re-publish to apply it to the scores.
            </p>
          )}

          <div className="overflow-x-auto border border-border">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-elevated text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
                  <th className="px-3 py-3 font-semibold">Player</th>
                  <th className="px-3 py-3 font-semibold">Ops tag</th>
                  <th className="px-3 py-3 font-semibold">Headband(s)</th>
                  <th className="px-3 py-3 font-semibold">Gun</th>
                  <th className="px-3 py-3 font-semibold">Stats</th>
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
      </CollapsibleSection>

      {/* Profile-link pickers live in a modal (portaled to body) so the search
          results are never clipped by the roster table's horizontal scroll. */}
      {linkFor && (
        <Modal title="Link to a profile" onClose={() => setLinkFor(null)} maxWidth="max-w-sm">
          <AccountPicker autoFocus onPick={(a) => linkRow(linkFor, a)} onCancel={() => setLinkFor(null)} />
        </Modal>
      )}
      {uaLinkFor != null && (
        <Modal title={`Link headband ${uaLinkFor} to a profile`} onClose={() => setUaLinkFor(null)} maxWidth="max-w-sm">
          <AccountPicker autoFocus onPick={(a) => addHeadband(uaLinkFor, a)} onCancel={() => setUaLinkFor(null)} />
        </Modal>
      )}

      {/* Admin drinks editor for a player (walk-ins who didn't self-report). */}
      {drinkFor && (
        <Modal
          title={`Drinks for ${drinkFor.account?.full_name || drinkFor.account?.ops_tag || "player"}`}
          onClose={() => setDrinkFor(null)}
          maxWidth="max-w-sm"
        >
          {drinks.length === 0 ? (
            <p className="text-sm text-text-muted">No drinks on the menu yet. Add some under &ldquo;Drinks menu&rdquo; first.</p>
          ) : (
            <div className="space-y-2">
              {drinks.map((d) => {
                const q = drinkQty[d.id] ?? 0;
                return (
                  <div key={d.id} className="flex items-center justify-between gap-3 border border-border bg-bg px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-text">{d.name}</p>
                      <p className="text-xs text-text-subtle">{formatEur(Number(d.price_eur))}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="One fewer"
                        onClick={() => setDrinkQty((s) => ({ ...s, [d.id]: Math.max(0, (s[d.id] ?? 0) - 1) }))}
                        className="flex h-7 w-7 items-center justify-center border border-border-strong text-text-muted hover:border-accent hover:text-accent"
                      >
                        –
                      </button>
                      <span className="w-6 text-center font-mono text-sm text-text">{q}</span>
                      <button
                        type="button"
                        aria-label="One more"
                        onClick={() => setDrinkQty((s) => ({ ...s, [d.id]: (s[d.id] ?? 0) + 1 }))}
                        className="flex h-7 w-7 items-center justify-center border border-border-strong text-text-muted hover:border-accent hover:text-accent"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm text-text-muted">Drinks total</span>
                <span className="font-semibold text-text">{formatEur(drinksTotalPreview)}</span>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDrinkFor(null)}
                  className="px-3 py-2 text-xs uppercase tracking-[0.1em] text-text-subtle hover:text-text"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveDrinks}
                  disabled={busy}
                  className="border border-accent bg-accent/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-accent hover:bg-accent/20 disabled:opacity-50"
                >
                  Save drinks
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
