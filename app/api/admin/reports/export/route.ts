/**
 * app/api/admin/reports/export/route.ts
 * --------------------------------------------------------------------
 * Admin CSV export for financial + token reporting. type = financial |
 * token_ledger, with optional from/to (ISO dates) on the relevant timestamp.
 * Admin-gated; reads through the admin's authenticated session (RLS lets admins
 * read every financial + token row). Returns text/csv.
 */
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, string | number | null>;

function csv(headers: string[], rows: Row[]): string {
  const esc = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(",")];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h] ?? "")).join(","));
  return lines.join("\r\n");
}

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toISOString().replace("T", " ").slice(0, 19) : "";
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Not signed in.", { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return new Response("Admins only.", { status: 403 });

  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "token_ledger";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  // Make `to` inclusive of the whole day.
  const toEnd = to ? new Date(new Date(to).getTime() + 86_400_000).toISOString() : null;

  // Resolve ops tags for a set of account ids in one query.
  async function tags(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter(Boolean))];
    const map = new Map<string, string>();
    if (unique.length === 0) return map;
    const { data } = await supabase.from("accounts").select("id, ops_tag").in("id", unique);
    for (const a of data ?? []) map.set(a.id, a.ops_tag ?? "");
    return map;
  }

  let filename = "report.csv";
  let headers: string[] = [];
  let rows: Row[] = [];

  if (type === "financial") {
    let q = supabase
      .from("financial_entries")
      .select("occurred_at, direction, category, amount_eur, method, account_id, match_id, source, source_ref, note")
      .order("occurred_at", { ascending: false });
    if (from) q = q.gte("occurred_at", from);
    if (toEnd) q = q.lte("occurred_at", toEnd);
    const { data } = await q;
    const t = await tags((data ?? []).map((r) => r.account_id));
    filename = "financial-ledger.csv";
    headers = ["Date", "Direction", "Category", "Amount EUR", "Method", "Player", "Match", "Source", "Ref", "Note"];
    rows = (data ?? []).map((r) => ({
      Date: fmtDate(r.occurred_at),
      Direction: r.direction,
      Category: r.category,
      "Amount EUR": (r.direction === "refund" ? "-" : "") + Number(r.amount_eur).toFixed(2),
      Method: r.method ?? "",
      Player: t.get(r.account_id) ?? "",
      Match: r.match_id ?? "",
      Source: r.source ?? "",
      Ref: r.source_ref ?? "",
      Note: r.note ?? "",
    }));
  } else {
    // token_ledger (default)
    let q = supabase
      .from("token_transactions")
      .select("account_id, delta, kind, eur_amount, note, match_id, purchase_id, created_at")
      .order("created_at", { ascending: false });
    if (from) q = q.gte("created_at", from);
    if (toEnd) q = q.lte("created_at", toEnd);
    const { data } = await q;
    const t = await tags((data ?? []).map((r) => r.account_id));
    filename = "token-ledger.csv";
    headers = ["Date", "Player", "Type", "Tokens", "EUR", "Note", "Match", "Purchase"];
    rows = (data ?? []).map((r) => ({
      Date: fmtDate(r.created_at),
      Player: t.get(r.account_id) ?? "",
      Type: r.kind,
      Tokens: Number(r.delta),
      EUR: r.eur_amount != null ? Number(r.eur_amount).toFixed(2) : "",
      Note: r.note ?? "",
      Match: r.match_id ?? "",
      Purchase: r.purchase_id ?? "",
    }));
  }

  const body = csv(headers, rows);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
