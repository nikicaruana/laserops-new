"use client";

/**
 * components/admin/ReportControls.tsx
 * --------------------------------------------------------------------
 * Filter + export controls for the admin financial reports. Report type is a
 * segmented switch; a from/to date range narrows it. "Apply" pushes the filters
 * to the URL (the server page re-queries). "Download CSV" links to the export
 * route with the same params; "Print" opens the browser print dialog for a
 * clean save-as-PDF of the on-screen report.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

const TYPES = [
  { key: "financial", label: "Financial ledger" },
  { key: "token_ledger", label: "Token ledger" },
  { key: "charts", label: "Charts" },
] as const;

export function ReportControls({ type, from, to, basis }: { type: string; from: string; to: string; basis: string }) {
  const router = useRouter();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const [b, setB] = useState(basis);
  // The date-basis dropdown only makes sense for money entries (game vs payment
  // date). The token ledger has only its one timestamp, so hide it there.
  const showBasis = type !== "token_ledger";

  function apply(nextType = type) {
    const p = new URLSearchParams();
    p.set("type", nextType);
    if (f) p.set("from", f);
    if (t) p.set("to", t);
    if (b && b !== "game") p.set("basis", b);
    router.push(`/admin/reports?${p.toString()}`);
  }

  const exportHref = (() => {
    const p = new URLSearchParams();
    p.set("type", type);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (basis && basis !== "game") p.set("basis", basis);
    return `/api/admin/reports/export?${p.toString()}`;
  })();

  // [color-scheme:dark] makes the native date-picker icon visible on the dark bg.
  const input =
    "h-10 rounded-none border border-border-strong bg-bg-elevated px-3 text-sm text-text focus:border-accent focus:outline-none [color-scheme:dark]";

  return (
    <div className="mb-6 print:hidden">
      <div className="mb-4 inline-flex flex-wrap border border-border-strong">
        {TYPES.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => apply(x.key)}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition ${
              type === x.key ? "bg-accent text-black" : "text-text-muted hover:text-accent"
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {showBasis && (
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">Filter by</label>
            <select value={b} onChange={(e) => setB(e.target.value)} className={input}>
              <option value="game">Game date</option>
              <option value="payment">Payment date</option>
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">From</label>
          <input type="date" value={f} onChange={(e) => setF(e.target.value)} className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">To</label>
          <input type="date" value={t} onChange={(e) => setT(e.target.value)} className={input} />
        </div>
        <Button variant="secondary" size="md" onClick={() => apply()}>
          Apply
        </Button>
        {/* CSV is a raw row dump of the ledger — not meaningful for the aggregated
            Charts view, which offers Print / Save PDF (chart + summary table). */}
        {type !== "charts" && (
          <Button variant="primary" size="md" href={exportHref}>
            Download CSV
          </Button>
        )}
        <Button variant="ghost" size="md" onClick={() => window.print()}>
          Print / Save PDF
        </Button>
      </div>
    </div>
  );
}
