"use client";

/**
 * components/admin/FinancialCharts.tsx
 * --------------------------------------------------------------------
 * "Charts" tab of the admin financial reports. Revenue over time as a stacked bar
 * chart (grouped by Month / Game / Day) over the reports date range, with a token-
 * usage count panel below sharing the same columns.
 *
 * Revenue (ABOVE, euros): from `financial_entries` (same source as the ledger, so
 * totals tie out) — Game Fees, Drinks, Token Pack Sales, Other; net = payments −
 * refunds. Tokens Used (BELOW, a COUNT not euros): from `token_transactions`
 * (kind='spend') — not revenue (booked at pack purchase), just a usage/frequency
 * note on its own axis. Hovers: revenue shows per-type € + (for games) paid vs
 * played + (for packs) who bought; tokens shows who used them.
 */
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatEur } from "@/lib/money";
import { cn } from "@/lib/cn";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Categorical revenue palette — validated CVD-safe + lightness band (light+dark).
// Fixed order, never cycled. Tokens-used is a muted slate note colour.
const COLORS = {
  game: "#2563eb",   // Game Fees — blue
  drinks: "#0d9488", // Drinks — teal
  tokens: "#c2740a", // Token Pack Sales — amber
  other: "#7c3aed",  // Other — violet
  used: "#64748b",   // Tokens Used — slate (a note, not revenue)
} as const;

const REVENUE_SERIES = [
  { key: "game", label: "Game Fees", color: COLORS.game },
  { key: "drinks", label: "Drinks", color: COLORS.drinks },
  { key: "tokens", label: "Token Pack Sales", color: COLORS.tokens },
  { key: "other", label: "Other", color: COLORS.other },
] as const;

type GroupBy = "month" | "game" | "day";

type Person = { ops: string; value: number };
type Bucket = {
  key: string; label: string; sort: number;
  game: number; drinks: number; tokens: number; other: number; // € net
  tokensUsed: number; tokenUsers: Person[];                     // count + who used
  tokenBuyers: Person[];                                        // who bought packs (€)
  played: number; paid: number; gameCount: number;             // game attendance/payment
  isEvent: boolean;                                             // by-game: a non-game event bar
};

type FinRow = { category: string | null; direction: string | null; amount_eur: number | string | null; occurred_at: string; match_id: string | null; account_id: string | null };
type SpendRow = { account_id: string | null; delta: number | string | null; match_id: string | null; created_at: string };
type MatchRow = { id: string; match_code: string | null; title: string | null; scheduled_at: string | null; played_on: string | null };
type PartRow = { match_id: string | null; paid_at: string | null; payment_intent: string | null };

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayLabel = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
const num = (v: number | string | null | undefined) => (v == null ? 0 : Number(v)) || 0;
const tokenStr = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(2));

export function FinancialCharts({ from, to }: { from: string; to: string }) {
  const [groupBy, setGroupBy] = useState<GroupBy>("month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fin, setFin] = useState<FinRow[]>([]);
  const [spends, setSpends] = useState<SpendRow[]>([]);
  const [matchList, setMatchList] = useState<MatchRow[]>([]);
  const [opsById, setOpsById] = useState<Map<string, string>>(new Map());
  const [playedByMatch, setPlayedByMatch] = useState<Map<string, number>>(new Map());
  const [paidByMatch, setPaidByMatch] = useState<Map<string, number>>(new Map());

  const fromIso = from || new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
  const toEndIso = to ? new Date(new Date(to).getTime() + 86_400_000).toISOString() : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const supabase = createClient();
        let finQ = supabase.from("financial_entries").select("category, direction, amount_eur, occurred_at, match_id, account_id").gte("occurred_at", fromIso).order("occurred_at");
        if (toEndIso) finQ = finQ.lte("occurred_at", toEndIso);
        let spendQ = supabase.from("token_transactions").select("account_id, delta, match_id, created_at").eq("kind", "spend").gte("created_at", fromIso).order("created_at");
        if (toEndIso) spendQ = spendQ.lte("created_at", toEndIso);
        let gamesQ = supabase.from("matches").select("id, match_code, title, scheduled_at, played_on").eq("status", "completed").gte("scheduled_at", fromIso).order("scheduled_at");
        if (toEndIso) gamesQ = gamesQ.lte("scheduled_at", toEndIso);
        const [{ data: finData, error: finErr }, { data: spendData, error: spendErr }, { data: gamesData, error: gamesErr }] = await Promise.all([finQ, spendQ, gamesQ]);
        if (finErr) throw new Error(finErr.message);
        if (spendErr) throw new Error(spendErr.message);
        if (gamesErr) throw new Error(gamesErr.message);
        const finRows = (finData ?? []) as FinRow[];
        const spendRows = (spendData ?? []) as SpendRow[];
        const games = (gamesData ?? []) as MatchRow[];

        // All match ids we need labels/attendance for = completed-in-range ∪ referenced.
        const refIds = new Set<string>(games.map((g) => g.id));
        for (const r of finRows) if (r.match_id) refIds.add(r.match_id);
        for (const s of spendRows) if (s.match_id) refIds.add(s.match_id);
        const missing = [...refIds].filter((id) => !games.some((g) => g.id === id));
        const acctIds = [...new Set([...spendRows.map((r) => r.account_id), ...finRows.filter((r) => r.category === "tokens").map((r) => r.account_id)].filter(Boolean) as string[])];
        const idList = [...refIds];
        const [missRes, acctRes, partRes, aggRes] = await Promise.all([
          missing.length ? supabase.from("matches").select("id, match_code, title, scheduled_at, played_on").in("id", missing) : Promise.resolve({ data: [] }),
          acctIds.length ? supabase.from("accounts").select("id, ops_tag").in("id", acctIds) : Promise.resolve({ data: [] }),
          idList.length ? supabase.from("match_participants").select("match_id, paid_at, payment_intent").in("match_id", idList) : Promise.resolve({ data: [] }),
          idList.length ? supabase.from("match_player_aggregate").select("match_id").in("match_id", idList) : Promise.resolve({ data: [] }),
        ]);
        if (cancelled) return;
        const played = new Map<string, number>();
        for (const a of (aggRes.data ?? []) as { match_id: string }[]) played.set(a.match_id, (played.get(a.match_id) ?? 0) + 1);
        const paid = new Map<string, number>();
        for (const p of (partRes.data ?? []) as PartRow[]) {
          if (!p.match_id) continue;
          if (p.paid_at != null || p.payment_intent === "token") paid.set(p.match_id, (paid.get(p.match_id) ?? 0) + 1);
        }
        setFin(finRows); setSpends(spendRows);
        setMatchList([...games, ...((missRes.data ?? []) as MatchRow[])]);
        setOpsById(new Map(((acctRes.data ?? []) as { id: string; ops_tag: string | null }[]).map((a) => [a.id, a.ops_tag ?? "—"])));
        setPlayedByMatch(played); setPaidByMatch(paid);
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
    const matchById = new Map(matchList.map((m) => [m.id, m]));
    const ensure = (key: string, label: string, sort: number, isEvent = false): Bucket => {
      let b = map.get(key);
      if (!b) { b = { key, label, sort, game: 0, drinks: 0, tokens: 0, other: 0, tokensUsed: 0, tokenUsers: [], tokenBuyers: [], played: 0, paid: 0, gameCount: 0, isEvent }; map.set(key, b); }
      return b;
    };
    const dateBucket = (d: Date) => groupBy === "day" ? ensure(dayKey(d), dayLabel(d), d.getTime()) : ensure(monthKey(d), monthLabel(d), new Date(d.getFullYear(), d.getMonth(), 1).getTime());
    const gameBucket = (m: MatchRow) => { const md = new Date(m.scheduled_at || m.played_on || Date.now()); return ensure(`g:${m.id}`, m.match_code || m.title || "Game", md.getTime()); };
    const addPerson = (list: Person[], ops: string, value: number) => { const e = list.find((x) => x.ops === ops); if (e) e.value += value; else list.push({ ops, value }); };

    // Games → attendance (paid vs played). In game mode every completed game is
    // its own bar (so fully-unpaid games still show); else bucketed by game date.
    for (const m of matchList) {
      const md = new Date(m.scheduled_at || m.played_on || Date.now());
      const b = groupBy === "game" ? gameBucket(m) : dateBucket(md);
      b.played += playedByMatch.get(m.id) ?? 0;
      b.paid += paidByMatch.get(m.id) ?? 0;
      b.gameCount += 1;
    }

    // Revenue
    for (const r of fin) {
      const d = new Date(r.occurred_at);
      const signed = (r.direction === "refund" ? -1 : 1) * num(r.amount_eur);
      let b: Bucket;
      if (groupBy === "game" && r.match_id) { const m = matchById.get(r.match_id); b = m ? gameBucket(m) : ensure(`g:${r.match_id}`, "Game", d.getTime()); }
      else if (groupBy === "game") b = ensure(`e:${dayKey(d)}`, dayLabel(d), d.getTime(), true);
      else b = dateBucket(d);
      const cat = r.category === "game" ? "game" : r.category === "drinks" ? "drinks" : r.category === "tokens" ? "tokens" : "other";
      b[cat] += signed;
      if (cat === "tokens" && r.direction !== "refund" && r.account_id) addPerson(b.tokenBuyers, opsById.get(r.account_id) ?? "—", num(r.amount_eur));
    }

    // Tokens used (count)
    for (const s of spends) {
      const d = new Date(s.created_at);
      const count = -num(s.delta);
      if (count <= 0) continue;
      let b: Bucket;
      if (groupBy === "game" && s.match_id) { const m = matchById.get(s.match_id); b = m ? gameBucket(m) : ensure(`g:${s.match_id}`, "Game", d.getTime()); }
      else if (groupBy === "game") b = ensure(`e:${dayKey(d)}`, dayLabel(d), d.getTime(), true);
      else b = dateBucket(d);
      b.tokensUsed += count;
      addPerson(b.tokenUsers, s.account_id ? opsById.get(s.account_id) ?? "—" : "Walk-in", count);
    }

    return [...map.values()].sort((a, b) => a.sort - b.sort);
  }, [fin, spends, matchList, opsById, playedByMatch, paidByMatch, groupBy]);

  const hasData = buckets.length > 0;
  const maxTokens = Math.max(1, ...buckets.map((b) => b.tokensUsed));
  const totalRevenue = buckets.reduce((s, b) => s + b.game + b.drinks + b.tokens + b.other, 0);
  const totalTokens = buckets.reduce((s, b) => s + b.tokensUsed, 0);

  const Y_WIDTH = 64;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <div className="inline-flex border border-border-strong">
          {(["month", "game", "day"] as GroupBy[]).map((g) => (
            <button key={g} type="button" onClick={() => setGroupBy(g)} className={cn("px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition", groupBy === g ? "bg-accent text-black" : "text-text-muted hover:text-accent")}>
              {g === "month" ? "By month" : g === "game" ? "By game" : "By day"}
            </button>
          ))}
        </div>
        <span className="text-xs text-text-subtle">Date range is set by the From / To filter above.</span>
      </div>

      {/* Legend — identity never colour-alone. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        {REVENUE_SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-2 text-xs text-text-muted">
            <span className="inline-block h-3 w-3 rounded-[3px]" style={{ backgroundColor: s.color }} />{s.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-2 text-xs text-text-muted">
          <span className="inline-block h-3 w-3 rounded-[3px]" style={{ backgroundColor: COLORS.used }} />Tokens Used (count, not revenue)
        </span>
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-text-muted">Loading…</p>
      ) : error ? (
        <p className="py-16 text-center text-sm text-red-400">{error}</p>
      ) : !hasData ? (
        <p className="py-16 text-center text-sm text-text-muted">No financial activity in this range.</p>
      ) : (
        <>
          <div className="border border-border bg-bg-elevated p-4">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-text-subtle">Revenue (€)</p>
              <p className="text-xs text-text-muted">Total <span className="font-bold text-emerald-400">{formatEur(totalRevenue)}</span></p>
            </div>
            {/* Revenue: x-axis labels sit at the BOTTOM of this panel — i.e. between
                the two charts. The token panel below hides its own labels. */}
            <ResponsiveContainer width="100%" height={groupBy === "game" ? 360 : 330}>
              <BarChart data={buckets} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barCategoryGap="34%">
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.5} />
                <YAxis width={Y_WIDTH} tick={{ fill: "var(--color-text-subtle)", fontSize: 11 }} tickFormatter={(v) => `€${Math.round(Number(v))}`} axisLine={false} tickLine={false} />
                <XAxis dataKey="label" tick={{ fill: "var(--color-text-subtle)", fontSize: 11 }} interval="preserveStartEnd" axisLine={false} tickLine={false} angle={groupBy === "game" ? -30 : 0} textAnchor={groupBy === "game" ? "end" : "middle"} height={groupBy === "game" ? 58 : 24} />
                <Tooltip cursor={{ fill: "var(--color-text)", fillOpacity: 0.05 }} content={<RevenueTooltip />} />
                {REVENUE_SERIES.map((s) => (
                  <Bar key={s.key} dataKey={s.key} stackId="rev" fill={s.color} maxBarSize={44} radius={s.key === "other" ? [4, 4, 0, 0] : undefined} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-1 mb-1 flex items-center justify-between border-t border-border/60 pt-3">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-text-subtle">Tokens used (count)</p>
              <p className="text-xs text-text-muted">Total <span className="font-bold" style={{ color: COLORS.used }}>{tokenStr(totalTokens)} tokens</span></p>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={buckets} margin={{ top: 0, right: 16, left: 0, bottom: 4 }} barCategoryGap="34%">
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.5} />
                <YAxis width={Y_WIDTH} domain={[0, Math.ceil(maxTokens)]} reversed tick={{ fill: "var(--color-text-subtle)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <XAxis dataKey="label" hide />
                <Tooltip cursor={{ fill: "var(--color-text)", fillOpacity: 0.05 }} content={<TokensTooltip />} />
                <Bar dataKey="tokensUsed" fill={COLORS.used} maxBarSize={44} radius={[0, 0, 4, 4]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Aggregated table — reference on screen, and what Print / Save PDF captures. */}
          <div className="mt-6 overflow-x-auto border border-border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-elevated">
                  {["Period", "Game Fees", "Drinks", "Token Packs", "Other", "Revenue", "Tokens Used"].map((h, i) => (
                    <th key={h} className={cn("px-3 py-2 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-subtle", i > 0 && "text-right")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {buckets.map((b) => (
                  <tr key={b.key} className="border-b border-border/60">
                    <td className="px-3 py-2 text-text">{b.label}{b.isEvent ? " · events" : ""}</td>
                    <td className="px-3 py-2 text-right text-text-muted">{formatEur(b.game)}</td>
                    <td className="px-3 py-2 text-right text-text-muted">{formatEur(b.drinks)}</td>
                    <td className="px-3 py-2 text-right text-text-muted">{formatEur(b.tokens)}</td>
                    <td className="px-3 py-2 text-right text-text-muted">{formatEur(b.other)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-text">{formatEur(b.game + b.drinks + b.tokens + b.other)}</td>
                    <td className="px-3 py-2 text-right text-text-muted">{b.tokensUsed > 0 ? tokenStr(b.tokensUsed) : "—"}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border bg-bg-elevated font-bold">
                  <td className="px-3 py-2 text-text">Total</td>
                  <td className="px-3 py-2 text-right text-text">{formatEur(buckets.reduce((s, b) => s + b.game, 0))}</td>
                  <td className="px-3 py-2 text-right text-text">{formatEur(buckets.reduce((s, b) => s + b.drinks, 0))}</td>
                  <td className="px-3 py-2 text-right text-text">{formatEur(buckets.reduce((s, b) => s + b.tokens, 0))}</td>
                  <td className="px-3 py-2 text-right text-text">{formatEur(buckets.reduce((s, b) => s + b.other, 0))}</td>
                  <td className="px-3 py-2 text-right text-emerald-400">{formatEur(totalRevenue)}</td>
                  <td className="px-3 py-2 text-right text-text">{tokenStr(totalTokens)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
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
  const pending = b.played - b.paid;
  const buyers = [...b.tokenBuyers].sort((a, c) => c.value - a.value);
  return (
    <div className="min-w-[200px] border border-border-strong bg-bg px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-bold text-text">{b.label}{b.isEvent ? " · events" : ""}</p>
      {rows.length === 0 ? <p className="text-text-muted">No revenue</p> : rows.map((r) => (
        <p key={r.key} className="flex items-center justify-between gap-4 text-text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-[2px]" style={{ backgroundColor: r.color }} />{r.label}</span>
          <span className="font-semibold tabular-nums text-text">{formatEur(r.value)}</span>
        </p>
      ))}
      <p className="mt-1 flex items-center justify-between gap-4 border-t border-border/60 pt-1 text-text">
        <span className="font-bold">Total</span><span className="font-bold tabular-nums text-emerald-400">{formatEur(total)}</span>
      </p>
      {b.gameCount > 0 && (
        <p className="mt-1 flex items-center justify-between gap-4 border-t border-border/60 pt-1">
          <span className="text-text-muted">Paid / Played</span>
          <span className="tabular-nums"><span className="font-semibold text-text">{b.paid}</span><span className="text-text-subtle"> / {b.played}</span>{pending > 0 && <span className="ml-1 text-red-400">({pending} pending)</span>}</span>
        </p>
      )}
      {buyers.length > 0 && (
        <>
          <p className="mt-1 border-t border-border/60 pt-1 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-subtle">Token packs bought by</p>
          {buyers.map((u) => (<p key={u.ops} className="flex items-center justify-between gap-4 text-text-muted"><span>{u.ops}</span><span className="tabular-nums text-text">{formatEur(u.value)}</span></p>))}
        </>
      )}
    </div>
  );
}

function TokensTooltip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const b = payload[0].payload;
  if (b.tokensUsed <= 0) return null;
  const users = [...b.tokenUsers].sort((a, c) => c.value - a.value);
  return (
    <div className="min-w-[180px] border border-border-strong bg-bg px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-bold text-text">{b.label}</p>
      <p className="mb-1 flex items-center justify-between gap-4"><span className="text-text-muted">Tokens used</span><span className="font-bold tabular-nums" style={{ color: COLORS.used }}>{tokenStr(b.tokensUsed)}</span></p>
      <p className="mb-1 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-subtle">Who used tokens</p>
      {users.map((u) => (<p key={u.ops} className="flex items-center justify-between gap-4 text-text-muted"><span>{u.ops}</span><span className="tabular-nums text-text">{tokenStr(u.value)}</span></p>))}
    </div>
  );
}
