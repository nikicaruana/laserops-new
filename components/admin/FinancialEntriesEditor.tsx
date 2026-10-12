"use client";

/**
 * components/admin/FinancialEntriesEditor.tsx
 * --------------------------------------------------------------------
 * The financial ledger table with an "Edit entries" mode: amount, direction,
 * category, method, note and date become editable per row, and each row can be
 * deleted. Changes are applied only after a 2FA step (TotpGate), via the
 * admin_update_financial_entry / admin_delete_financial_entry RPCs. Player and
 * game are read-only (they tie the entry to who/what it was for).
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TotpGate } from "@/components/admin/TotpGate";
import { formatEur } from "@/lib/money";

export type FinEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  direction: string; // payment | refund
  category: string; // game | drinks | tokens | other
  amountEur: number;
  method: string | null;
  playerTag: string;
  matchCode: string;
  note: string;
};

const CATS = ["game", "drinks", "tokens", "other"];
const METHODS = ["cash", "revolut", "bank", "card", "other"];

function fmtDate(d: string): string {
  if (!d) return "";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const inp = "h-8 w-full rounded-none border border-border-strong bg-bg px-1.5 text-xs text-text focus:border-accent focus:outline-none";

export function FinancialEntriesEditor({ initial }: { initial: FinEntry[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<FinEntry[]>(initial);
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [gateOpen, setGateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initMap = useMemo(() => new Map(initial.map((e) => [e.id, e])), [initial]);

  function set(id: string, key: keyof FinEntry, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  }
  function toggleDelete(id: string) {
    setDeleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function cancel() {
    setRows(initial);
    setDeleted(new Set());
    setEditing(false);
    setError(null);
  }

  async function runSave() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    try {
      for (const id of deleted) {
        const { error: err } = await supabase.rpc("admin_delete_financial_entry", { p_id: id });
        if (err) throw new Error(err.message);
      }
      for (const r of rows) {
        if (deleted.has(r.id)) continue;
        const i = initMap.get(r.id);
        if (!i) continue;
        const changed =
          r.date !== i.date || r.direction !== i.direction || r.category !== i.category ||
          Number(r.amountEur) !== Number(i.amountEur) || (r.method ?? "") !== (i.method ?? "") || (r.note ?? "") !== (i.note ?? "");
        if (!changed) continue;
        const { error: err } = await supabase.rpc("admin_update_financial_entry", {
          p_id: r.id,
          p_direction: r.direction,
          p_category: r.category,
          p_amount: Number(r.amountEur),
          p_method: r.method || null,
          p_note: r.note || null,
          p_occurred_at: r.date || null,
        });
        if (err) throw new Error(err.message);
      }
      setGateOpen(false);
      setEditing(false);
      setDeleted(new Set());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save changes.");
    } finally {
      setBusy(false);
    }
  }

  const dirtyCount =
    deleted.size +
    rows.filter((r) => {
      if (deleted.has(r.id)) return false;
      const i = initMap.get(r.id);
      return i && (r.date !== i.date || r.direction !== i.direction || r.category !== i.category || Number(r.amountEur) !== Number(i.amountEur) || (r.method ?? "") !== (i.method ?? "") || (r.note ?? "") !== (i.note ?? ""));
    }).length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-text-subtle">Ledger entries</p>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="border border-border-strong px-3 py-1.5 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-text transition-colors hover:border-accent hover:text-accent"
          >
            Edit entries
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button type="button" onClick={cancel} disabled={busy} className="px-3 py-1.5 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-text-subtle hover:text-text disabled:opacity-50">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setGateOpen(true)}
              disabled={busy || dirtyCount === 0}
              className="border border-accent bg-accent/10 px-3 py-1.5 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-accent hover:bg-accent/20 disabled:opacity-50"
            >
              {dirtyCount > 0 ? `Save ${dirtyCount} change${dirtyCount === 1 ? "" : "s"} (2FA)` : "No changes"}
            </button>
          </div>
        )}
      </div>

      {error && <p className="mb-3 border border-red-800 bg-red-950/40 px-4 py-2.5 text-sm text-red-400">{error}</p>}

      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-elevated">
              {["Date", "Direction", "Category", "Game", "Amount", "Method", "Player", "Note", ...(editing ? [""] : [])].map((h, i) => (
                <th key={i} className="px-3 py-2 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-subtle">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const del = deleted.has(r.id);
              if (!editing) {
                return (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="px-3 py-2 text-text-muted">{fmtDate(r.date)}</td>
                    <td className={`px-3 py-2 ${r.direction === "refund" ? "text-red-400" : "text-text-muted"}`}>{r.direction === "refund" ? "Refund" : "Payment"}</td>
                    <td className="px-3 py-2 text-text-muted capitalize">{r.category}</td>
                    <td className="px-3 py-2 text-text-muted">{r.matchCode}</td>
                    <td className="px-3 py-2 text-text-muted">{r.direction === "refund" ? "-" : ""}{formatEur(Number(r.amountEur))}</td>
                    <td className="px-3 py-2 text-text-muted">{r.method ?? ""}</td>
                    <td className="px-3 py-2 text-text-muted">{r.playerTag}</td>
                    <td className="px-3 py-2 text-text-muted">{r.note}</td>
                  </tr>
                );
              }
              return (
                <tr key={r.id} className={`border-b border-border/60 ${del ? "opacity-40" : ""}`}>
                  <td className="px-2 py-1.5">
                    <input type="date" className={inp} value={r.date} disabled={del} onChange={(e) => set(r.id, "date", e.target.value)} />
                  </td>
                  <td className="px-2 py-1.5">
                    <select className={inp} value={r.direction} disabled={del} onChange={(e) => set(r.id, "direction", e.target.value)}>
                      <option value="payment">Payment</option>
                      <option value="refund">Refund</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <select className={inp} value={r.category} disabled={del} onChange={(e) => set(r.id, "category", e.target.value)}>
                      {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-1.5 text-xs text-text-subtle">{r.matchCode || "-"}</td>
                  <td className="px-2 py-1.5">
                    <input type="number" step="0.01" min="0" className={`${inp} w-20`} value={String(r.amountEur)} disabled={del} onChange={(e) => set(r.id, "amountEur", e.target.value)} />
                  </td>
                  <td className="px-2 py-1.5">
                    <select className={inp} value={r.method ?? ""} disabled={del} onChange={(e) => set(r.id, "method", e.target.value)}>
                      <option value="">-</option>
                      {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-1.5 text-xs text-text-subtle">{r.playerTag || "-"}</td>
                  <td className="px-2 py-1.5">
                    <input className={inp} value={r.note} disabled={del} onChange={(e) => set(r.id, "note", e.target.value)} />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => toggleDelete(r.id)}
                      className={`text-[0.6rem] font-bold uppercase tracking-[0.1em] ${del ? "text-accent hover:text-accent-soft" : "text-text-subtle hover:text-red-400"}`}
                    >
                      {del ? "Undo" : "Delete"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={editing ? 9 : 8} className="px-3 py-8 text-center text-sm text-text-muted">No entries in this range.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TotpGate
        open={gateOpen}
        action={`save ${dirtyCount} financial ledger change${dirtyCount === 1 ? "" : "s"}`}
        onCancel={() => setGateOpen(false)}
        onVerified={runSave}
      />
    </div>
  );
}
