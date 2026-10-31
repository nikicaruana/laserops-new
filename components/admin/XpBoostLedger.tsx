"use client";

/**
 * components/admin/XpBoostLedger.tsx
 * --------------------------------------------------------------------
 * Read-only view of the append-only XP-boost ledger (xp_boost_ledger): every
 * boost granted (admin or level-up reward), spent at sign-in, or adjusted,
 * newest first. Mirrors TokenLedger but for the 2x / 1.5x XP boosts, which live
 * in their own balance separate from game tokens. Collapsed by default, with a
 * type filter and incremental "show more". Rows are fetched server-side (admin
 * RLS); this component only filters/paginates what it is given.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { CollapsibleSection } from "@/components/admin/CollapsibleSection";

export type XpBoostLedgerRow = {
  id: string;
  created_at: string;
  boostType: "double" | "one_five";
  delta: number;
  kind: "grant" | "spend" | "adjustment";
  reason: string | null;
  level: number | null;
  player: string | null;
  playerOps: string | null;
  actor: string | null;
  matchCode: string | null;
};

const PAGE = 25;

const fmtDelta = (n: number) => `${n > 0 ? "+" : n < 0 ? "-" : ""}${Math.abs(n)}`;
const boostLabel = (t: XpBoostLedgerRow["boostType"]) => (t === "double" ? "2x XP" : "1.5x XP");

const KIND_LABEL: Record<XpBoostLedgerRow["kind"], string> = {
  grant: "Grant",
  spend: "Spend",
  adjustment: "Adjustment",
};

// Grants add boosts (positive); spends remove them (negative); adjustments can
// go either way. Colour by direction so the sign and colour always agree.
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

export function XpBoostLedger({ initial }: { initial: XpBoostLedgerRow[] }) {
  const [kind, setKind] = useState<"all" | XpBoostLedgerRow["kind"]>("all");
  const [shown, setShown] = useState(PAGE);

  const filtered = useMemo(
    () => (kind === "all" ? initial : initial.filter((r) => r.kind === kind)),
    [initial, kind],
  );

  const select =
    "h-8 border border-border-strong bg-bg px-2.5 text-xs font-semibold uppercase tracking-[0.1em] text-text focus:border-accent focus:outline-none";

  return (
    <CollapsibleSection
      title="XP boost activity"
      count={initial.length}
      defaultOpen={false}
      subtitle="Every XP boost granted (admin or level-up), spent at sign-in, or adjusted, newest first. Showing the most recent activity."
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
          <option value="adjustment">Adjustments</option>
        </select>
        <span className="ml-auto text-xs text-text-subtle">
          {filtered.length} entr{filtered.length === 1 ? "y" : "ies"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-sm border border-border bg-bg-elevated p-4 text-sm text-text-muted">
          No boost activity{kind === "all" ? " yet" : ` of this type`}.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Player</th>
                  <th className="py-2 pr-3">Boost</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3 text-right">Count</th>
                  <th className="py-2 pr-3">Note</th>
                  <th className="py-2 pr-3">By</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, shown).map((r) => {
                  // "By" = the admin actor for a manual grant; a level-up reward has
                  // no actor, so show what the ledger recorded as the reason instead.
                  const by = r.actor ?? (r.level != null ? `Level ${r.level}` : "System");
                  return (
                    <tr key={r.id} className="border-b border-border/60 align-top">
                      <td className="whitespace-nowrap py-2 pr-3 text-text-muted">{fmtWhen(r.created_at)}</td>
                      <td className="py-2 pr-3">
                        <span className="text-text">{r.player || r.playerOps || "Unknown"}</span>
                        {r.player && r.playerOps && (
                          <span className="ml-1.5 font-mono text-xs text-text-subtle">{r.playerOps}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 text-text">{boostLabel(r.boostType)}</td>
                      <td className="whitespace-nowrap py-2 pr-3 text-text-muted">{KIND_LABEL[r.kind]}</td>
                      <td className={`whitespace-nowrap py-2 pr-3 text-right font-mono font-semibold tabular-nums ${deltaClass(r.delta)}`}>
                        {fmtDelta(r.delta)}
                      </td>
                      <td className="py-2 pr-3 text-text-muted">
                        {r.matchCode ? (
                          <Link href={`/match-report?match=${r.matchCode}`} className="font-mono text-xs text-accent hover:underline">
                            {r.matchCode}
                          </Link>
                        ) : null}
                        {r.matchCode && r.reason ? " · " : null}
                        {r.reason}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 text-text-subtle">{by}</td>
                    </tr>
                  );
                })}
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
