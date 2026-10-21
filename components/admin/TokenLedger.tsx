"use client";

/**
 * components/admin/TokenLedger.tsx
 * --------------------------------------------------------------------
 * Read-only view of the append-only token ledger (token_transactions): every
 * grant, spend, refund, expiry and manual adjustment, newest first. Collapsed
 * by default (it is a long log), with a kind filter and incremental "show more"
 * so a single open does not render hundreds of rows at once. Rows are fetched
 * server-side (admin RLS); this component only filters/paginates what it is
 * given.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { CollapsibleSection } from "@/components/admin/CollapsibleSection";
import { formatEur } from "@/lib/money";

export type TokenLedgerRow = {
  id: string;
  created_at: string;
  delta: number;
  kind: "grant" | "spend" | "refund" | "expiry" | "adjustment";
  eur_amount: number | null;
  note: string | null;
  player: string | null;
  playerOps: string | null;
  actor: string | null;
  matchCode: string | null;
};

const PAGE = 25;

const fmtTokens = (n: number) => (Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(2))));
const fmtDelta = (n: number) => `${n > 0 ? "+" : n < 0 ? "-" : ""}${fmtTokens(Math.abs(n))}`;

const KIND_LABEL: Record<TokenLedgerRow["kind"], string> = {
  grant: "Grant",
  spend: "Spend",
  refund: "Refund",
  expiry: "Expiry",
  adjustment: "Adjustment",
};

// Grants/refunds add tokens (positive); spends/expiry remove them (negative);
// adjustments can go either way. Colour by direction, not kind, so the sign and
// the colour always agree.
function deltaClass(n: number) {
  if (n > 0) return "text-emerald-400";
  if (n < 0) return "text-red-400";
  return "text-text-muted";
}

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function TokenLedger({ initial }: { initial: TokenLedgerRow[] }) {
  const [kind, setKind] = useState<"all" | TokenLedgerRow["kind"]>("all");
  const [shown, setShown] = useState(PAGE);

  const filtered = useMemo(
    () => (kind === "all" ? initial : initial.filter((r) => r.kind === kind)),
    [initial, kind],
  );

  const select =
    "h-8 border border-border-strong bg-bg px-2.5 text-xs font-semibold uppercase tracking-[0.1em] text-text focus:border-accent focus:outline-none";

  return (
    <CollapsibleSection
      title="Token ledger"
      count={initial.length}
      defaultOpen={false}
      subtitle="Every grant, spend, refund, expiry and manual adjustment, newest first. Showing the most recent activity."
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          aria-label="Filter by type"
          className={select}
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as typeof kind);
            setShown(PAGE);
          }}
        >
          <option value="all">All types</option>
          <option value="grant">Grants</option>
          <option value="spend">Spends</option>
          <option value="refund">Refunds</option>
          <option value="expiry">Expiries</option>
          <option value="adjustment">Adjustments</option>
        </select>
        <span className="ml-auto text-xs text-text-subtle">
          {filtered.length} entr{filtered.length === 1 ? "y" : "ies"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-sm border border-border bg-bg-elevated p-4 text-sm text-text-muted">
          No ledger entries{kind === "all" ? " yet" : ` of this type`}.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Player</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3 text-right">Tokens</th>
                  <th className="py-2 pr-3 text-right">€</th>
                  <th className="py-2 pr-3">Note</th>
                  <th className="py-2 pr-3">By</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, shown).map((r) => (
                  <tr key={r.id} className="border-b border-border/60 align-top">
                    <td className="whitespace-nowrap py-2 pr-3 text-text-muted">{fmtWhen(r.created_at)}</td>
                    <td className="py-2 pr-3">
                      <span className="text-text">{r.player || r.playerOps || "Unknown"}</span>
                      {r.player && r.playerOps && (
                        <span className="ml-1.5 font-mono text-xs text-text-subtle">{r.playerOps}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-text-muted">{KIND_LABEL[r.kind]}</td>
                    <td className={`whitespace-nowrap py-2 pr-3 text-right font-mono font-semibold tabular-nums ${deltaClass(r.delta)}`}>
                      {fmtDelta(r.delta)}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums text-text-muted">
                      {r.eur_amount != null ? formatEur(r.eur_amount) : "–"}
                    </td>
                    <td className="py-2 pr-3 text-text-muted">
                      {r.matchCode ? (
                        <Link href={`/match-report?match=${r.matchCode}`} className="font-mono text-xs text-accent hover:underline">
                          {r.matchCode}
                        </Link>
                      ) : null}
                      {r.matchCode && r.note ? " · " : null}
                      {r.note}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-text-subtle">{r.actor || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length > shown && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE)}
                className="border border-border-strong px-5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-text-muted transition-colors hover:border-accent hover:text-accent"
              >
                Show more ({filtered.length - shown} left)
              </button>
            </div>
          )}
        </>
      )}
    </CollapsibleSection>
  );
}
