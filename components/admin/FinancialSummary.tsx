"use client";

/**
 * components/admin/FinancialSummary.tsx
 * --------------------------------------------------------------------
 * Dashboard money summary. Reads the financial ledger (RLS admin-only) once for
 * the last ~2 years, then computes Payments in / Refunds out / Net revenue for
 * the selected period (MTD / QTD / YTD) with a comparison against the equivalent
 * previous period, plus the last 10 transactions in that period - each showing
 * who it was for/by (player + game) and the time. All computed client-side from
 * the one fetch, so the dropdown is instant.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatEur } from "@/lib/money";

type Entry = {
  occurred_at: string;
  direction: string;
  category: string;
  amount_eur: number | string;
  account_id: string | null;
  match_id: string | null;
  note: string | null;
};
type Period = "mtd" | "qtd" | "ytd";

const CAT_LABEL: Record<string, string> = { tokens: "Tokens", game: "Game", drinks: "Drinks", other: "Other" };

function ranges(period: Period, now: Date) {
  const y = now.getFullYear();
  const m = now.getMonth();
  let start: Date, prevStart: Date, prevEnd: Date;
  if (period === "mtd") {
    start = new Date(y, m, 1);
    prevStart = new Date(y, m - 1, 1);
    prevEnd = new Date(now);
    prevEnd.setMonth(prevEnd.getMonth() - 1);
  } else if (period === "qtd") {
    const qStartMonth = Math.floor(m / 3) * 3;
    start = new Date(y, qStartMonth, 1);
    prevStart = new Date(y, qStartMonth - 3, 1);
    prevEnd = new Date(now);
    prevEnd.setMonth(prevEnd.getMonth() - 3);
  } else {
    start = new Date(y, 0, 1);
    prevStart = new Date(y - 1, 0, 1);
    prevEnd = new Date(now);
    prevEnd.setFullYear(prevEnd.getFullYear() - 1);
  }
  return { start, end: now, prevStart, prevEnd };
}

function sums(entries: Entry[], start: Date, end: Date) {
  let payments = 0,
    refunds = 0;
  for (const e of entries) {
    const t = new Date(e.occurred_at).getTime();
    if (t < start.getTime() || t > end.getTime()) continue;
    const amt = Number(e.amount_eur) || 0;
    if (e.direction === "refund") refunds += amt;
    else payments += amt;
  }
  return { payments, refunds, net: payments - refunds };
}

function Delta({ current, previous, goodWhenUp = true }: { current: number; previous: number; goodWhenUp?: boolean }) {
  const diff = current - previous;
  const pct = previous === 0 ? (current === 0 ? 0 : 100) : (diff / Math.abs(previous)) * 100;
  const up = diff > 0.005;
  const down = diff < -0.005;
  const good = (up && goodWhenUp) || (down && !goodWhenUp);
  const tone = up || down ? (good ? "text-emerald-400" : "text-red-400") : "text-text-subtle";
  const arrow = up ? "▲" : down ? "▼" : "–";
  return (
    <p className="mt-1 text-[0.7rem] text-text-subtle">
      <span className={tone}>
        {arrow} {Math.abs(pct).toFixed(0)}%
      </span>{" "}
      vs prev ({formatEur(previous)})
    </p>
  );
}

export function FinancialSummary() {
  const [period, setPeriod] = useState<Period>("mtd");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [opsTags, setOpsTags] = useState<Map<string, string>>(new Map());
  const [gameNames, setGameNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const supabase = createClient();
    const from = new Date(new Date().getFullYear() - 1, 0, 1).toISOString();
    (async () => {
      const { data } = await supabase
        .from("financial_entries")
        .select("occurred_at, direction, category, amount_eur, account_id, match_id, note")
        .gte("occurred_at", from)
        .order("occurred_at", { ascending: false });
      const list = (data ?? []) as Entry[];
      setEntries(list);

      // Resolve player tags + game names for the "who / for what" columns.
      const acctIds = [...new Set(list.map((e) => e.account_id).filter((x): x is string => Boolean(x)))];
      const matchIds = [...new Set(list.map((e) => e.match_id).filter((x): x is string => Boolean(x)))];
      const [accs, matches] = await Promise.all([
        acctIds.length ? supabase.from("accounts").select("id, ops_tag").in("id", acctIds) : Promise.resolve({ data: [] as { id: string; ops_tag: string | null }[] }),
        matchIds.length ? supabase.from("matches").select("id, match_code, title").in("id", matchIds) : Promise.resolve({ data: [] as { id: string; match_code: string | null; title: string | null }[] }),
      ]);
      const am = new Map<string, string>();
      for (const a of accs.data ?? []) am.set(a.id, a.ops_tag ?? "");
      const mm = new Map<string, string>();
      for (const m of matches.data ?? []) mm.set(m.id, m.match_code || m.title || "");
      setOpsTags(am);
      setGameNames(mm);
    })();
  }, []);

  const now = useMemo(() => new Date(), []);
  const view = useMemo(() => {
    if (!entries) return null;
    const { start, end, prevStart, prevEnd } = ranges(period, now);
    const cur = sums(entries, start, end);
    const prev = sums(entries, prevStart, prevEnd);
    const inPeriod = entries
      .filter((e) => {
        const t = new Date(e.occurred_at).getTime();
        return t >= start.getTime() && t <= end.getTime();
      })
      .slice(0, 10);
    return { cur, prev, inPeriod };
  }, [entries, period, now]);

  const metrics = view
    ? [
        { label: "Payments in", cur: view.cur.payments, prev: view.prev.payments, tone: "text-emerald-400", goodWhenUp: true },
        { label: "Refunds out", cur: view.cur.refunds, prev: view.prev.refunds, tone: "text-red-400", goodWhenUp: false },
        { label: "Net revenue", cur: view.cur.net, prev: view.prev.net, tone: "text-text", goodWhenUp: true },
      ]
    : [];

  return (
    <section className="mb-8 border border-border bg-bg-elevated px-5 py-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-accent">Financial summary</h2>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="h-9 rounded-none border border-border-strong bg-bg px-2 text-xs font-semibold uppercase tracking-[0.1em] text-text focus:border-accent focus:outline-none [color-scheme:dark]"
          >
            <option value="mtd">Month to date</option>
            <option value="qtd">Quarter to date</option>
            <option value="ytd">Year to date</option>
          </select>
          <Link href="/admin/reports" className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
            Reports →
          </Link>
        </div>
      </div>

      {!view ? (
        <p className="text-xs text-text-subtle">Loading…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {metrics.map((m) => (
              <div key={m.label} className="border border-border bg-bg px-5 py-4">
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-text-subtle">{m.label}</p>
                <p className={`mt-1 text-2xl font-bold tabular-nums ${m.tone}`}>{formatEur(m.cur)}</p>
                <Delta current={m.cur} previous={m.prev} goodWhenUp={m.goodWhenUp} />
              </div>
            ))}
          </div>

          <div className="mt-5">
            <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-text-subtle">Last transactions</p>
            {view.inPeriod.length === 0 ? (
              <p className="text-xs text-text-subtle">No transactions in this period.</p>
            ) : (
              <ul className="divide-y divide-border border border-border">
                {view.inPeriod.map((e, i) => {
                  const amt = Number(e.amount_eur) || 0;
                  const refund = e.direction === "refund";
                  const when = new Date(e.occurred_at).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const player = e.account_id ? opsTags.get(e.account_id) || "" : "";
                  const game = e.match_id ? gameNames.get(e.match_id) || "" : "";
                  const meta = [player, game].filter(Boolean).join(" · ");
                  return (
                    <li key={i} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-text-muted">
                          {refund ? "Refund" : "Payment"} · {CAT_LABEL[e.category] ?? e.category}
                        </span>
                        <span className="truncate text-xs text-text-subtle">
                          {when}
                          {meta ? ` · ${meta}` : ""}
                        </span>
                      </span>
                      <span className={`shrink-0 font-semibold tabular-nums ${refund ? "text-red-400" : "text-text"}`}>
                        {refund ? "-" : ""}
                        {formatEur(amt)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
