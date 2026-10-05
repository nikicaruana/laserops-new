/**
 * app/api/signups/[matchId]/cancel/route.ts
 * --------------------------------------------------------------------
 * A player cancels their own signup. If they paid, a refund is applied per the
 * time-before-game policy:
 *   >= 48h  -> automatic full refund (cash via the provider + any tokens back)
 *   24-48h  -> flagged 'pending' for an admin to approve
 *   < 24h   -> non-refundable
 * The actual refund (cash-first, cash + tokens) is done by refundSignup. Payment-
 * truth columns are written with the service role, which bypasses the payment
 * guard + RLS; the player's identity + ownership are verified first.
 * Returns { ok, refund }.
 */
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getRefundConfig } from "@/lib/payments/refund-config";
import { refundSignup } from "@/lib/payments/refund";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const { data: account } = await supabase.from("accounts").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!account) return Response.json({ ok: false, error: "No account found." }, { status: 400 });

  const [{ data: signup }, { data: match }] = await Promise.all([
    supabase
      .from("match_signups")
      .select("status, paid_at, payment_ref, payment_provider")
      .eq("match_id", matchId)
      .eq("account_id", account.id)
      .maybeSingle(),
    supabase.from("matches").select("scheduled_at").eq("id", matchId).maybeSingle(),
  ]);
  if (!signup) return Response.json({ ok: false, error: "You're not signed up to this game." }, { status: 404 });

  const svc = createServiceClient();
  if (!svc) return Response.json({ ok: false, error: "Server not configured." }, { status: 500 });

  // Unpaid (or already handled): just cancel.
  if (!signup.paid_at) {
    await svc.from("match_signups").update({ status: "cancelled" }).eq("match_id", matchId).eq("account_id", account.id);
    return Response.json({ ok: true, refund: "none" });
  }

  const hours = match?.scheduled_at ? (new Date(match.scheduled_at).getTime() - Date.now()) / 3_600_000 : 0;
  const { autoRefundHours, noRefundHours } = await getRefundConfig();
  const providerId = signup.payment_provider || null;
  const ref = signup.payment_ref;

  // >= 48h with a captured online payment -> automatic full refund.
  if (hours >= autoRefundHours && providerId && ref) {
    const res = await refundSignup(svc, matchId, account.id, { fraction: 1, note: "Game refund (player cancel, auto)" });
    if (res.error) {
      console.error("[cancel] refund failed:", res.error);
      return Response.json({ ok: false, error: "Couldn't process the refund. Please contact us." }, { status: 502 });
    }
    await svc.from("match_signups").update({ status: "cancelled" }).eq("match_id", matchId).eq("account_id", account.id);
    return Response.json({ ok: true, refund: "refunded" });
  }

  // 24-48h (or paid with no online ref) -> pending admin approval.
  if (hours >= noRefundHours) {
    await svc.from("match_signups").update({ status: "cancelled", refund_status: "pending" }).eq("match_id", matchId).eq("account_id", account.id);
    return Response.json({ ok: true, refund: "pending" });
  }

  // < 24h -> non-refundable.
  await svc.from("match_signups").update({ status: "cancelled", refund_status: "denied" }).eq("match_id", matchId).eq("account_id", account.id);
  return Response.json({ ok: true, refund: "denied" });
}
