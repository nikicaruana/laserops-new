/**
 * app/api/admin/refund/route.ts
 * --------------------------------------------------------------------
 * Admin issues a full refund for a paid signup (approving a 24-48h request, or
 * any goodwill refund). Delegates to refundSignup, which returns the cash portion
 * via the capturing provider and credits the token portion back (cash first),
 * writes the refund bookkeeping and emits the `refunded` notification. Admin-
 * gated; writes with the service role. Body: { matchId, accountId }.
 * Returns { ok, cashEur, tokens }.
 */
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { refundSignup } from "@/lib/payments/refund";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return Response.json({ ok: false, error: "Admins only." }, { status: 403 });

  let matchId = "";
  let accountId = "";
  try {
    const body = (await req.json()) as { matchId?: string; accountId?: string };
    matchId = String(body.matchId ?? "");
    accountId = String(body.accountId ?? "");
  } catch {
    return Response.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  if (!matchId || !accountId) return Response.json({ ok: false, error: "Missing match or player." }, { status: 400 });

  const svc = createServiceClient();
  if (!svc) return Response.json({ ok: false, error: "Server not configured." }, { status: 500 });

  const res = await refundSignup(svc, matchId, accountId, { fraction: 1, note: "Admin refund" });
  if (res.error) return Response.json({ ok: false, error: "Refund failed. Check the provider dashboard." }, { status: 502 });
  if (res.skipped === "no signup" || res.skipped === "not paid") {
    return Response.json({ ok: false, error: "That signup isn't marked paid." }, { status: 400 });
  }
  return Response.json({ ok: true, cashEur: res.cashEur, tokens: res.tokens });
}
