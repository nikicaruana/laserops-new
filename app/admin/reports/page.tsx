/**
 * app/admin/reports/page.tsx
 * --------------------------------------------------------------------
 * Financial + token reporting. "Financial ledger" is the single source of truth
 * for money: every payment or refund (online token purchases, online + in-person
 * game payments, drink sales, refunds) as a typed row. "Token ledger" shows token
 * movements (grants/spends/refunds/expiry). Both over an optional date range, with
 * totals, an on-screen table (print/save-as-PDF), a CSV download, and a form to
 * record in-person payments. Reads through the admin session (RLS admin-only).
 */
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ReportControls } from "@/components/admin/ReportControls";
import { ManualEntryForm } from "@/components/admin/ManualEntryForm";
import { formatEur } from "@/lib/money";

export const metadata: Metadata = { title: "Financial reports" };

const PREVIEW_LIMIT = 100;
const FETCH_LIMIT = 2000;

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
}
function fmtTokens(n: number): string {
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(4)));
}
const CAT_LABEL: Record<string, string> = { tokens: "Tokens", game: "Game", drinks: "Drinks", other: "Other" };

async function opsTags(supabase: Awaited<ReturnType<typeof createClient>>, ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data } = await supabase.from("accounts").select("id, ops_tag").in("id", unique);
  for (const a of data ?? []) map.set(a.id, a.ops_tag ?? "");
  return map;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="border border-border bg-bg-elevated px-4 py-3">
      <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-text-subtle">{label}</p>
      <p className={`mt-1 text-lg font-bold ${tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-red-400" : "text-text"}`}>{value}</p>
    </div>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ type?: string; from?: string; to?: string }> }) {
  const sp = await searchParams;
  const type = sp.type === "token_ledger" ? "token_ledger" : "financial";
  const from = sp.from || "";
  const to = sp.to || "";
  const toEnd = to ? new Date(new Date(to).getTime() + 86_400_000).toISOString() : null;

  const supabase = await createClient();

  let summaryStats: { label: string; value: string; tone?: "pos" | "neg" }[] = [];
  let categoryStats: { label: string; value: string }[] = [];
  let head: string[] = [];
  let body: (string | number)[][] = [];
  let total = 0;
  let truncated = false;

  // Recent games, so a manual in-person entry can be tied to a game id.
  const { data: recentGames } =
    type === "financial"
      ? await supabase.from("matches").select("id, match_code, title, scheduled_at").order("scheduled_at", { ascending: false }).limit(60)
      : { data: [] as { id: string; match_code: string | null; title: string | null; scheduled_at: string | null }[] };
  const gameOptions = (recentGames ?? []).map((g) => ({
    id: g.id,
    label: `${g.match_code || g.title || "Game"}${g.scheduled_at ? ` · ${new Date(g.scheduled_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}` : ""}`,
  }));

  if (type === "token_ledger") {
    let q = supabase
      .from("token_transactions")
      .select("account_id, delta, kind, eur_amount, note, created_at")
      .order("created_at", { ascending: false })
      .limit(FETCH_LIMIT);
    if (from) q = q.gte("created_at", from);
    if (toEnd) q = q.lte("created_at", toEnd);
    const { data } = await q;
    const rows = data ?? [];
    total = rows.length;
    truncated = rows.length >= FETCH_LIMIT;
    const granted = rows.filter((r) => Number(r.delta) > 0).reduce((s, r) => s + Number(r.delta), 0);
    const spent = rows.filter((r) => r.kind === "spend").reduce((s, r) => s + -Number(r.delta), 0);
    const expired = rows.filter((r) => r.kind === "expiry").reduce((s, r) => s + -Number(r.delta), 0);
    summaryStats = [
      { label: "Entries", value: String(rows.length) },
      { label: "Tokens in (grant/refund)", value: fmtTokens(granted) },
      { label: "Tokens spent", value: fmtTokens(spent) },
      { label: "Tokens expired", value: fmtTokens(expired) },
    ];
    const tags = await opsTags(supabase, rows.map((r) => r.account_id));
    head = ["Date", "Player", "Type", "Tokens", "EUR", "Note"];
    body = rows.slice(0, PREVIEW_LIMIT).map((r) => [
      fmtDate(r.created_at),
      tags.get(r.account_id) ?? "",
      r.kind,
      (Number(r.delta) >= 0 ? "+" : "") + fmtTokens(Number(r.delta)),
      r.eur_amount != null ? formatEur(Number(r.eur_amount)) : "",
      r.note ?? "",
    ]);
  } else {
    // financial ledger
    let q = supabase
      .from("financial_entries")
      .select("occurred_at, direction, category, amount_eur, method, account_id, match_id, note")
      .order("occurred_at", { ascending: false })
      .limit(FETCH_LIMIT);
    if (from) q = q.gte("occurred_at", from);
    if (toEnd) q = q.lte("occurred_at", toEnd);
    const { data } = await q;
    const rows = data ?? [];
    total = rows.length;
    truncated = rows.length >= FETCH_LIMIT;
    const payments = rows.filter((r) => r.direction === "payment").reduce((s, r) => s + Number(r.amount_eur), 0);
    const refunds = rows.filter((r) => r.direction === "refund").reduce((s, r) => s + Number(r.amount_eur), 0);
    const byCat = (cat: string) =>
      rows.filter((r) => r.category === cat).reduce((s, r) => s + (r.direction === "payment" ? 1 : -1) * Number(r.amount_eur), 0);
    summaryStats = [
      { label: "Payments in", value: formatEur(payments), tone: "pos" },
      { label: "Refunds out", value: formatEur(refunds), tone: "neg" },
      { label: "Net revenue", value: formatEur(payments - refunds) },
    ];
    categoryStats = [
      { label: "Games", value: formatEur(byCat("game")) },
      { label: "Tokens", value: formatEur(byCat("tokens")) },
      { label: "Drinks", value: formatEur(byCat("drinks")) },
      { label: "Other", value: formatEur(byCat("other")) },
    ];
    // Resolve player tags + game codes for the visible rows.
    const shown = rows.slice(0, PREVIEW_LIMIT);
    const tags = await opsTags(supabase, shown.map((r) => r.account_id));
    const matchIds = [...new Set(shown.map((r) => r.match_id).filter((x): x is string => Boolean(x)))];
    const codes = new Map<string, string>();
    if (matchIds.length) {
      const { data: ms } = await supabase.from("matches").select("id, match_code, title").in("id", matchIds);
      for (const m of ms ?? []) codes.set(m.id, m.match_code || m.title || m.id.slice(0, 8));
    }
    head = ["Date", "Direction", "Category", "Game", "Amount", "Method", "Player", "Note"];
    body = shown.map((r) => [
      fmtDate(r.occurred_at),
      r.direction === "refund" ? "Refund" : "Payment",
      CAT_LABEL[r.category] ?? r.category,
      r.match_id ? codes.get(r.match_id) ?? "" : "",
      `${r.direction === "refund" ? "-" : ""}${formatEur(Number(r.amount_eur))}`,
      r.method ?? "",
      tags.get(r.account_id) ?? "",
      r.note ?? "",
    ]);
  }

  const rangeLabel = from || to ? `${from || "start"} → ${to || "now"}` : "All time";

  return (
    <div>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Financial reports</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          Every token and money movement, exportable to CSV or printed to PDF. Range: <span className="text-text">{rangeLabel}</span>.
        </p>
      </header>

      <ReportControls type={type} from={from} to={to} />

      {type === "financial" && <ManualEntryForm games={gameOptions} />}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summaryStats.map((s) => (
          <Stat key={s.label} label={s.label} value={s.value} tone={s.tone} />
        ))}
      </div>

      {type === "financial" && (
        <div className="mb-6">
          <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-text-subtle">Net revenue by category</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {categoryStats.map((s) => (
              <Stat key={s.label} label={s.label} value={s.value} />
            ))}
          </div>
          <p className="mt-2 max-w-3xl text-xs text-text-subtle">
            These four add up to net revenue (payments minus refunds), split by what the money was for.{" "}
            <span className="text-text-muted">Tokens</span> = money taken for token bundles and gifts.{" "}
            <span className="text-text-muted">Games</span> = game fees paid in cash or by card. A game paid with a token
            isn&apos;t counted again here - that money was already counted under Tokens when the tokens were bought.{" "}
            <span className="text-text-muted">Drinks</span> = on-site drink sales.
          </p>
        </div>
      )}

      {body.length === 0 ? (
        <p className="text-sm text-text-muted">No records in this range.</p>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-elevated">
                {head.map((h) => (
                  <th key={h} className="px-3 py-2 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-subtle">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, i) => (
                <tr key={i} className="border-b border-border/60">
                  {r.map((c, j) => (
                    <td key={j} className={`px-3 py-2 ${head[j] === "Direction" && c === "Refund" ? "text-red-400" : "text-text-muted"}`}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(body.length >= PREVIEW_LIMIT || truncated) && (
        <p className="mt-3 text-xs text-text-subtle">
          Showing the first {Math.min(PREVIEW_LIMIT, body.length)} of {truncated ? `${FETCH_LIMIT}+` : total} rows. Download the CSV for the
          full range.
        </p>
      )}
    </div>
  );
}
