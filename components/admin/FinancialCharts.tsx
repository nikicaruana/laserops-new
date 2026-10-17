"use client";

/**
 * components/admin/FinancialCharts.tsx
 * --------------------------------------------------------------------
 * "Charts" tab of the admin financial reports. Visualises revenue over time as a
 * stacked bar chart, grouped by Month / Game / Day, over the reports date range.
 *
 * Revenue (ABOVE zero, euros) is stacked by type from `financial_entries` (the
 * same source of truth as the ledger, so totals tie out): Game Fees, Drinks,
 * Token Pack Sales, Other. Net = payments minus refunds.
 *
 * Tokens Used (BELOW, in a separate aligned panel) is NOT revenue — the money was
 * already booked when the pack was bought. It's a usage/frequency note: a COUNT of
 * tokens redeemed per bucket, from `token_transactions` (kind='spend'). Its own
 * axis (count, not euros) so it never looks like it adds to revenue; hovering a
 * bucket lists who used tokens.
 *
 * By Game: each game is a bar; non-game events (e.g. buying token packs) are their
 * own bars, grouped by day. By Month / Day: everything in that period aggregates.
 */
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatEur } from "@/lib/money";
import { cn } from "@/lib/cn";
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

// Categorical revenue palette — validated (CVD-safe, lightness band) in both
// light and dark. Fixed order; never cycled. Tokens-used is a muted note colour.
const COLORS = {
  game: "#3b82f6",   // Game Fees — blue
  drinks: "#0d9488", // Drinks — teal
  tokens: "#d97706", // Token Pack Sales — amber
  other: "#8b5cf6",  // Other — violet
  used: "#94a3b8",   // Tokens Used — slate (a note, not revenue)
} as const;

const REVENUE_SERIES = [
  { key: "game", label: "Game Fees", color: COLORS.game },
  { key: "drinks", label: "Drinks", color: COLORS.drinks },
  { key: "tokens", label: "Token Pack Sales", color: COLORS.tokens },
  { key: "other", label: "Other", color: COLORS.other },
] as const;

type GroupBy = "month" | "game" | "day";

type Bucket = {
  key: string;
  label: string;
  sort: number; // epoch for ordering
  game: number; drinks: number; tokens: number; other: number; // € net
  tokensUsed: number; // count of tokens redeemed
  tokenUsers: { ops: string; tokens: number }[];
  isEvent: boolean; // by-game mode: a non-game event bar (e.g. pack purchases)
};

type FinRow = { category: string | null; direction: string | null; amount_eur: number | string | null; occurred_at: string; match_id: string | null; account_id: string | null };
type SpendRow = { account_id: string | null; delta: number | string | null; match_id: string | null; created_at: string };
type MatchRow = { id: string; match_code: string | null; title: string | null; scheduled_at: string | null; played_on: string | null };

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayLabel = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
const num = (v: number | string | null | undefined) => (v == null ? 0 : Number(v)) || 0;

export function FinancialCharts({ from, to }: { from: string; to: string }) {
  const [groupBy, setGroupBy] = useState<GroupBy>("month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fin, setFin] = useState<FinRow[]>([]);
  const [spends, setSpends] = useState<SpendRow[]>([]);
  const [matches, setMatches] = useState<Map<string, MatchRow>>(new Map());
  const [opsById, setOpsById] = useState<Map<string, string>>(new Map());

  // Default to the last 12 months when no range is set, to keep the fetch bounded.
  const fromIso = from || new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
  const toEndIso = to ? new Date(new Date(to).getTime() + 86_400_000).toISOString() : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        let finQ = supabase.from("financial_entries").select("category, direction, amount_eur, occurred_at, match_id, account_id").gte("occurred_at", fromIso).order("occurred_at");
        if (toEndIso) finQ = finQ.lte("occurred_at", toEndIso);
        let spendQ = supabase.from("token_transactions").select("account_id, delta, match_id, created_at").eq("kind", "spend").gte("created_at", fromIso).order("created_at");
        if (toEndIso) spendQ = spendQ.lte("created_at", toEndIso);
        const [{ data: finData, error: finErr }, { data: spendData, error: spendErr }] = await Promise.all([finQ, spendQ]);
        if (finErr) throw new Error(finErr.message);
        if (spendErr) throw new Error(spendErr.message);
        const finRows = (finData ?? []) as FinRow[];
        const spendRows = (spendData ?? []) as SpendRow[];

        // Resolve the match + account maps we need for by-game labels and the
        // "who used tokens" hover.
        const matchIds = [...new Set([...finRows.map((r) => r.match_id), ...spendRows.map((r) => r.match_id)].filter(Boolean) as string[])];
        const acctIds = [...new Set(spendRows.map((r) => r.account_id).filter(Boolean) as string[])];
        const [matchRes, acctRes] = await Promise.all([
          matchIds.length ? supabase.from("matches").select("id, match_code, title, scheduled_at, played_on").in("id", matchIds) : Promise.resolve({ data: [] }),
          acctIds.length ? supabase.from("accounts").select("id, ops_tag").in("id", acctIds) : Promise.resolve({ data: [] }),
        ]);
        if (cancelled) return;
        setFin(finRows);
        setSpends(spendRows);
        setMatches(new Map(((matchRes.data ?? []) as MatchRow[]).map((m) => [m.id, m])));
        setOpsById(new Map(((acctRes.data ?? []) as { id: string; ops_tag: string | null }[]).map((a) => [a.id, a.ops_tag ?? "—"])));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load chart data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fromIso, toEndIso]);

  const buckets = useMemo<Bucket[]>(() => {
    const map = new Map<string, Bucket>();
    const matchDate = (m: MatchRow | undefined, fallback: string) => new Date(m?.scheduled_at || m?.played_on || fallback);
    const ensure = (key: string, label: string, sort: number, isEvent = false): Bucket => {
      let b = map.get(key);
      if (!b) { b = { key, label, sort, game: 0, drinks: 0, tokens: 0, other: 0, tokensUsed: 0, tokenUsers: [], isEvent }; map.set(key, b); }
      return b;
    };

    // Revenue
    for (const r of fin) {
      const d = new Date(r.occurred_at);
      const signed = (r.direction === "refund" ? -1 : 1) * num(r.amount_eur);
      let b: Bucket;
      if (groupBy === "game" && r.match_id) {
        const m = matches.get(r.match_id);
        const md = matchDate(m, r.occurred_at);
        b = ensure(`g:${r.match_id}`, m?.match_code || m?.title || "Game", md.getTime());
      } else if (groupBy === "game") {
        // Non-game event (e.g. token pack purchase) — its own bar, grouped by day.
        b = ensure(`e:${dayKey(d)}`, dayLabel(d), d.getTime(), true);
      } else if (groupBy === "day") {
        b = ensure(dayKey(d), dayLabel(d), d.getTime());
      } else {
        b = ensure(monthKey(d), monthLabel(d), new Date(d.getFullYear(), d.getMonth(), 1).getTime());
      }
      const cat = r.category === "game" ? "game" : r.category === "drinks" ? "drinks" : r.category === "tokens" ? "tokens" : "other";
      b[cat] += signed;
    }

    // Tokens used (count) — spends always carry a match_id (tokens pay for a game).
    for (const s of spends) {
      const d = new Date(s.created_at);
      const count = -num(s.delta); // delta is negative on a spend
      if (count <= 0) continue;
      let b: Bucket;
      if (groupBy === "game" && s.match_id) {
        const m = matches.get(s.match_id);
        const md = matchDate(m, s.created_at);
        b = ensure(`g:${s.match_id}`, m?.match_code || m?.title || "Game", md.getTime());
      } else if (groupBy === "game") {
        b = ensure(`e:${dayKey(d)}`, dayLabel(d), d.getTime(), true);
      } else if (groupBy === "day") {
        b = ensure(dayKey(d), dayLabel(d), d.getTime());
      } else {
        b = ensure(monthKey(d), monthLabel(d), new Date(d.getFullYear(), d.getMonth(), 1).getTime());
      }
      b.tokensUsed += count;
      const ops = s.account_id ? opsById.get(s.account_id) ?? "—" : "Walk-in";
      const existing = b.tokenUsers.find((u) => u.ops === ops);
      if (existing) existing.tokens += count; else b.tokenUsers.push({ ops, tokens: count });
    }

    return [...map.values()].sort((a, b) => a.sort - b.sort);
  }, [fin, spends, matches, opsById, groupBy]);

  const hasData = buckets.length > 0;
  const maxTokens = Math.max(1, ...buckets.map((b) => b.tokensUsed));
  const totalRevenue = buckets.reduce((s, b) => s + b.game + b.drinks + b.tokens + b.other, 0);
  const totalTokens = buckets.reduce((s, b) => s + b.tokensUsed, 0);

  const Y_WIDTH = 64; // fixed so the two panels' columns line up
  const MARGIN = { top: 8, right: 16, left: 0, bottom: 0 };

  return (
    <div>
      {/* Controls: group-by (the date range comes from the reports From/To above). */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex border border-border-strong">
          {(["month", "game", "day"] as GroupBy[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroupBy(g)}
              className={cn(
                "px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition",
                groupBy === g ? "bg-accent text-black" : "text-text-muted hover:text-accent",
              )}
            >
              {g === "month" ? "By month" : g === "game" ? "By game" : "By day"}
            </button>
          ))}
        </div>
        <span className="text-xs text-text-subtle">Date range is set by the From / To filter above.</span>
      </div>

      {/* Legend — identity is never colour-alone. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        {REVENUE_SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-2 text-xs text-text-muted">
            <span className="inline-block h-3 w-3 rounded-[2px]" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-2 text-xs text-text-muted">
          <span className="inline-block h-3 w-3 rounded-[2px]" style={{ backgroundColor: COLORS.used }} />
          Tokens Used (count, not revenue)
        </span>
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-text-muted">Loading…</p>
      ) : error ? (
        <p className="py-16 text-center text-sm text-red-400">{error}</p>
      ) : !hasData ? (
        <p className="py-16 text-center text-sm text-text-muted">No financial activity in this range.</p>
      ) : (
        <div className="border border-border bg-bg-elevated p-4">
          {/* Revenue (above zero, euros) */}
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-text-subtle">Revenue (€)</p>
            <p className="text-xs text-text-muted">Total <span className="font-bold text-emerald-400">{formatEur(totalRevenue)}</span></p>
          </div>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={buckets} margin={MARGIN} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.5} />
              <XAxis dataKey="label" hide />
              <YAxis width={Y_WIDTH} tick={{ fill: "var(--color-text-subtle)", fontSize: 11 }} tickFormatter={(v) => `€${Math.round(Number(v))}`} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "var(--color-text)", fillOpacity: 0.05 }} content={<RevenueTooltip />} />
              {REVENUE_SERIES.map((s) => (
                <Bar key={s.key} dataKey={s.key} stackId="rev" fill={s.color} radius={s.key === "other" ? [3, 3, 0, 0] : undefined} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>

          {/* Tokens Used (below, a separate COUNT axis — not euros, not revenue) */}
          <div className="mt-2 mb-1 flex items-center justify-between border-t border-border/60 pt-3">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-text-subtle">Tokens used (count)</p>
            <p className="text-xs text-text-muted">Total <span className="font-bold" style={{ color: COLORS.used }}>{totalTokens % 1 === 0 ? totalTokens : totalTokens.toFixed(2)} tokens</span></p>
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={buckets} margin={{ ...MARGIN, top: 0, bottom: 4 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.5} />
              <XAxis dataKey="label" tick={{ fill: "var(--color-text-subtle)", fontSize: 11 }} interval="preserveStartEnd" axisLine={false} tickLine={false} angle={groupBy === "game" ? -30 : 0} textAnchor={groupBy === "game" ? "end" : "middle"} height={groupBy === "game" ? 54 : 24} />
              <YAxis width={Y_WIDTH} domain={[0, Math.ceil(maxTokens)]} reversed tick={{ fill: "var(--color-text-subtle)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: "var(--color-text)", fillOpacity: 0.05 }} content={<TokensTooltip />} />
              <Bar dataKey="tokensUsed" fill={COLORS.used} radius={[0, 0, 3, 3]} isAnimationActive={false}>
                {buckets.map((b) => (<Cell key={b.key} fill={COLORS.used} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

type TipProps = { active?: boolean; payload?: { payload: Bucket }[] };

function RevenueTooltip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const b = payload[0].payload;
  const rows = REVENUE_SERIES.map((s) => ({ ...s, value: b[s.key] })).filter((r) => Math.abs(r.value) > 0.005);
  const total = b.game + b.drinks + b.tokens + b.other;
  return (
    <div className="min-w-[180px] border border-border-strong bg-bg px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-bold text-text">{b.label}{b.isEvent ? " · events" : ""}</p>
      {rows.length === 0 ? (
        <p className="text-text-muted">No revenue</p>
      ) : (
        rows.map((r) => (
          <p key={r.key} className="flex items-center justify-between gap-4 text-text-muted">
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-[1px]" style={{ backgroundColor: r.color }} />{r.label}</span>
            <span className="font-semibold tabular-nums text-text">{formatEur(r.value)}</span>
          </p>
        ))
      )}
      <p className="mt-1 flex items-center justify-between gap-4 border-t border-border/60 pt-1 text-text">
        <span className="font-bold">Total</span>
        <span className="font-bold tabular-nums text-emerald-400">{formatEur(total)}</span>
      </p>
    </div>
  );
}

function TokensTooltip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const b = payload[0].payload;
  if (b.tokensUsed <= 0) return null;
  const users = [...b.tokenUsers].sort((a, c) => c.tokens - a.tokens);
  return (
    <div className="min-w-[180px] border border-border-strong bg-bg px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-bold text-text">{b.label}</p>
      <p className="mb-1 flex items-center justify-between gap-4">
        <span className="text-text-muted">Tokens used</span>
        <span className="font-bold tabular-nums" style={{ color: COLORS.used }}>{b.tokensUsed % 1 === 0 ? b.tokensUsed : b.tokensUsed.toFixed(2)}</span>
      </p>
      <p className="mb-1 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-subtle">Who used tokens</p>
      {users.map((u) => (
        <p key={u.ops} className="flex items-center justify-between gap-4 text-text-muted">
          <span>{u.ops}</span>
          <span className="tabular-nums text-text">{u.tokens % 1 === 0 ? u.tokens : u.tokens.toFixed(2)}</span>
        </p>
      ))}
    </div>
  );
}
