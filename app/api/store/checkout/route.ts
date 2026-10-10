/**
 * app/api/store/checkout/route.ts
 * --------------------------------------------------------------------
 * Starts a hosted checkout for a token bundle. Creates a pre-payment
 * checkout_intent (via create_checkout_intent, which reads the bundle price
 * server-side so the client can never dictate the amount), then opens the payment
 * provider with purpose="token_bundle" carrying the intent id. The purchase +
 * ledger rows and the token grant happen ONLY in the webhook after payment is
 * confirmed (fulfill_checkout_intent) - abandoned checkouts leave just an
 * intent, never a financial record. Body: { bundleId }. Returns { ok, url }.
 */
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPaymentProvider } from "@/lib/payments";
import { toCents } from "@/lib/money";

export async function POST(req: NextRequest) {
  const provider = getPaymentProvider();
  if (!provider) {
    return Response.json({ ok: false, error: "Online payment isn't set up yet." }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const { data: account } = await supabase.from("accounts").select("id, email, full_name, ops_tag").eq("auth_user_id", user.id).maybeSingle();
  if (!account) return Response.json({ ok: false, error: "No account found." }, { status: 400 });

  let bundleId = "";
  try {
    const body = (await req.json()) as { bundleId?: string };
    bundleId = String(body.bundleId ?? "");
  } catch {
    return Response.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  if (!bundleId) return Response.json({ ok: false, error: "No bundle selected." }, { status: 400 });

  // Load the bundle (price is authoritative; RLS lets anyone read active bundles).
  const { data: bundle } = await supabase
    .from("token_bundles")
    .select("id, name, tokens, price_eur, is_active")
    .eq("id", bundleId)
    .maybeSingle();
  if (!bundle || !bundle.is_active) return Response.json({ ok: false, error: "That bundle isn't available." }, { status: 400 });

  // Create the pre-payment intent server-side (RPC re-reads the price).
  const { data: intentId, error: rpcErr } = await supabase.rpc("create_checkout_intent", {
    p_kind: "bundle",
    p_bundle_id: bundleId,
    p_gift_ops: null,
    p_gift_email: null,
    p_gift_message: null,
  });
  if (rpcErr || !intentId) {
    return Response.json({ ok: false, error: rpcErr?.message || "Couldn't start the purchase." }, { status: 400 });
  }

  const origin = req.headers.get("origin") || new URL(req.url).origin;
  const label = `${bundle.name} - ${Number(bundle.tokens)} game tokens`;

  try {
    const { url } = await provider.createCheckout({
      amountCents: toCents(Number(bundle.price_eur)),
      currency: "eur",
      label,
      successUrl: `${origin}/player-portal/profile?purchased=1`,
      cancelUrl: `${origin}/player-portal/store`,
      customerEmail: account.email,
      customerName: account.full_name || account.ops_tag || null,
      purpose: "token_bundle",
      matchId: String(intentId), // carries the intent id back on the webhook
      accountId: account.id,
    });
    return Response.json({ ok: true, url });
  } catch (err) {
    console.error("[store/checkout] payment error:", err);
    return Response.json({ ok: false, error: "Couldn't start checkout. Please try again." }, { status: 502 });
  }
}
