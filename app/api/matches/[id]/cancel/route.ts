/**
 * app/api/matches/[id]/cancel/route.ts
 * --------------------------------------------------------------------
 * Admin cancels a game. Calls admin_cancel_match (cancels + notifies players +
 * flags paid signups for refund), then ACTUALLY refunds every paid player in
 * full (cash via the provider + any tokens back) via refundAllPaidSignups - a DB
 * function can't call the payment API, so the payout happens here. If the game
 * was confirmed (calendar invites had gone out) an .ics CANCEL is also sent.
 * Returns { ok, refunded, invitesCancelled }.
 */
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendMatchInvites } from "@/lib/calendar-invite";
import { refundAllPaidSignups } from "@/lib/payments/refund";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return Response.json({ ok: false, error: "Admins only." }, { status: 403 });
  // Step-up: this ends a game / moves money, so require a 2FA-elevated session.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return Response.json({ ok: false, error: "Two-factor authentication is required to cancel a game." }, { status: 403 });

  const { data: before } = await supabase.from("matches").select("status").eq("id", id).maybeSingle();
  const wasConfirmed = before?.status === "confirmed";

  const { error } = await supabase.rpc("admin_cancel_match", { p_match_id: id });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 400 });

  const svc = createServiceClient();

  // Refund every paid player in full. Best-effort: a provider hiccup on one
  // player doesn't undo the cancellation; failures are logged + reported.
  let refunded = 0;
  const refundErrors: string[] = [];
  if (svc) {
    const r = await refundAllPaidSignups(svc, id, { fraction: 1, note: "Game cancelled" });
    refunded = r.refunded;
    refundErrors.push(...r.errors);
    if (r.errors.length) console.error("[cancel] some refunds failed:", r.errors);
  }

  // Confirmed games had calendar invites -> send an .ics CANCEL.
  let invitesCancelled = 0;
  if (wasConfirmed && svc) {
    const { data: m } = await svc.from("matches").select("calendar_sequence").eq("id", id).maybeSingle();
    await svc.from("matches").update({ calendar_sequence: (((m?.calendar_sequence as number) ?? 0) + 1) }).eq("id", id);
    const res = await sendMatchInvites(id, "CANCEL");
    invitesCancelled = res.sent;
  }

  return Response.json({ ok: true, refunded, refundErrors, invitesCancelled });
}
