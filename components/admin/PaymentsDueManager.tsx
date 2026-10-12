"use client";

/**
 * components/admin/PaymentsDueManager.tsx
 * --------------------------------------------------------------------
 * Cross-game "who still owes", settle-able in place. Each row can be marked paid
 * (Cash / Revolut) right here via admin_confirm_settlement - no need to open the
 * Match Manager. Any token the player applied on the pay page is already deducted;
 * confirming bills the cash/Revolut part (plus any declared drinks) and drops the
 * row. Grouped by game; totals recompute as rows are settled.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatEur } from "@/lib/money";

export type DueRow = {
  match_id: string;
  match_code: string | null;
  title: string | null;
  scheduled_at: string | null;
  account_id: string;
  ops_tag: string | null;
  full_name: string | null;
  email: string | null;
  settled_declared_at: string | null;
  player_marked_paid_at: string | null;
  settlement_token_intent: number | null;
  drinks_total_eur: number | null;
  settlement_method: string | null;
  game_fee: number | null;
  owed: number | null;
};

const fmtTok = (n: number) => (Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(2))));
const tokenLabel = (n: number) => (n <= 0 ? "" : `${fmtTok(n)} ${n === 1 ? "token" : "tokens"}`);
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-bg-elevated px-4 py-3">
      <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-text-subtle">{label}</p>
      <p className="mt-1 text-lg font-bold text-text">{value}</p>
    </div>
  );
}

export function PaymentsDueManager({ initial }: { initial: DueRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<DueRow[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<Record<string, string>>({});
  const [amt, setAmt] = useState<Record<string, string>>({});
  const gamePortion = (r: DueRow) => Math.round((Number(r.owed ?? 0) - Number(r.drinks_total_eur ?? 0)) * 100) / 100;

  const keyOf = (r: DueRow) => `${r.match_id}:${r.account_id}`;

  async function markPaid(r: DueRow) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const m = method[keyOf(r)] ?? r.settlement_method ?? "cash";
    const ovRaw = amt[keyOf(r)];
    const ov = ovRaw !== undefined && ovRaw !== "" ? Number(ovRaw) : NaN;
    const { error: err } = await supabase.rpc("admin_confirm_settlement", {
      p_match_id: r.match_id,
      p_account_id: r.account_id,
      p_method: m,
      p_amount_override: Number.isNaN(ov) ? null : ov,
    });
    setBusy(false);
    if (err) return setError(err.message);
    setRows((prev) => prev.filter((x) => keyOf(x) !== keyOf(r)));
    router.refresh();
  }

  const games = useMemo(() => {
    const list: { id: string; code: string; date: string; rows: DueRow[]; total: number }[] = [];
    const index = new Map<string, number>();
    for (const r of rows) {
      let i = index.get(r.match_id);
      if (i == null) {
        i = list.length;
        index.set(r.match_id, i);
        list.push({
          id: r.match_id,
          code: r.match_code || r.title || r.match_id.slice(0, 8),
          date: fmtDate(r.scheduled_at),
          rows: [],
          total: 0,
        });
      }
      list[i].rows.push(r);
      list[i].total += Number(r.owed ?? 0);
    }
    return list;
  }, [rows]);

  const totalOwed = rows.reduce((s, r) => s + Number(r.owed ?? 0), 0);

  if (rows.length === 0) {
    return (
      <p className="border border-dashed border-border px-4 py-12 text-center text-sm text-text-muted">
        Everyone&apos;s settled up. Nothing outstanding.
      </p>
    );
  }

  return (
    <>
      {error && <p className="mb-4 border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>}

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Players owing" value={String(rows.length)} />
        <Stat label="Games" value={String(games.length)} />
        <Stat label="Total outstanding" value={formatEur(totalOwed)} />
      </div>

      <div className="space-y-6">
        {games.map((g) => (
          <div key={g.id} className="border border-border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-bg-elevated px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-sm font-bold text-accent">{g.code}</span>
                {g.date && <span className="text-xs text-text-subtle">{g.date}</span>}
                <span className="text-xs text-text-muted">· {g.rows.length} owing · {formatEur(g.total)}</span>
              </div>
              <Link
                href={`/admin/matches/${g.id}`}
                className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-text-subtle hover:text-accent"
              >
                Open Match Manager →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
                    <th className="px-4 py-2.5 font-semibold">Player</th>
                    <th className="px-4 py-2.5 font-semibold">Declared</th>
                    <th className="px-4 py-2.5 font-semibold">Tokens used</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Owed</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Settle</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => {
                    const tok = Number(r.settlement_token_intent ?? 0);
                    const drinks = Number(r.drinks_total_eur ?? 0);
                    const k = keyOf(r);
                    return (
                      <tr key={k} className="border-b border-border/60 last:border-0 align-middle">
                        <td className="px-4 py-2.5">
                          <div className="flex flex-col gap-0.5">
                            <span>
                              <span className="font-semibold text-text">{r.full_name || r.ops_tag || "Player"}</span>
                              {r.ops_tag && <span className="ml-2 font-mono text-[0.7rem] text-text-subtle">{r.ops_tag}</span>}
                            </span>
                            {r.email && (
                              <a href={`mailto:${r.email}`} className="text-[0.7rem] text-text-subtle underline hover:text-accent">
                                {r.email}
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          {r.settled_declared_at ? (
                            <span className={r.player_marked_paid_at ? "text-emerald-300" : "text-amber-300"}>
                              {drinks > 0 ? `Drinks ${formatEur(drinks)} · ` : ""}
                              {r.player_marked_paid_at ? "player says paid" : "awaiting"}
                              {r.settlement_method ? ` (${r.settlement_method})` : ""}
                            </span>
                          ) : (
                            <span className="text-text-subtle">Not declared</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          {tok > 0 ? <span className="font-semibold text-accent">{tokenLabel(tok)}</span> : <span className="text-text-subtle">&ndash;</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-text">{formatEur(Number(r.owed ?? 0))}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-xs text-text-subtle">€</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={amt[k] ?? String(gamePortion(r))}
                              onChange={(e) => setAmt((s) => ({ ...s, [k]: e.target.value }))}
                              title="Game fee to charge (drinks are added on top)"
                              className="h-8 w-16 rounded-none border border-border-strong bg-bg px-1.5 text-xs text-text focus:border-accent focus:outline-none"
                            />
                            <select
                              className="h-8 rounded-none border border-border-strong bg-bg px-1.5 text-xs text-text focus:border-accent focus:outline-none"
                              value={method[k] ?? r.settlement_method ?? "cash"}
                              onChange={(e) => setMethod((s) => ({ ...s, [k]: e.target.value }))}
                            >
                              <option value="cash">Cash</option>
                              <option value="revolut">Revolut</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => markPaid(r)}
                              disabled={busy}
                              className="border border-accent bg-accent/10 px-2.5 py-1.5 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-accent hover:bg-accent/20 disabled:opacity-50"
                            >
                              Mark paid
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
