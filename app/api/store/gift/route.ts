/**
 * app/api/store/gift/route.ts
 * --------------------------------------------------------------------
 * Starts a hosted checkout for GIFTING game tokens - a single token or a bundle -
 * to another player (by ops tag) or to an email (claimed after they sign up).
 * Creates a pre-payment checkout_intent (kind=gift) via create_checkout_intent,
 * which prices it server-side and resolves the recipient, then opens the payment
 * provider. Delivery (credit the recipient or create a claimable gift) + emails
 * happen in the webhook after payment is confirmed. Body:
 * { bundleId?, single?, opsTag?, email?, message? }. Returns { ok, url }.
 */
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPaymentProvider } from "@/lib/payments";
import { toCents } from "@/lib/money";

export async function POST(req: NextRequest) {
  const provider = getPaymentProvider();
  if (!provider) return Response.json({ ok: false, error: "Online payment isn't set up yet." }, { status: 500 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const { data: account } = await supabase.from("accounts").select("id, email").eq("auth_user_id", user.id).maybeSingle();
  if (!account) return Response.json({ ok: false, error: "No account found." }, { status: 400 });

  let body: { bundleId?: string; single?: boolean; opsTag?: string; email?: string; message?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const opsTag = (body.opsTag ?? "").trim();
  const email = (body.email ?? "").trim();
  if (!opsTag && !email) return Response.json({ ok: false, error: "Add who the gift is for." }, { status: 400 });
  // A single token has no bundle id; a bundle gift carries the bundle id.
  const bundleId = body.single ? null : body.bundleId ?? null;
  if (!body.single && !bundleId) return Response.json({ ok: false, error: "Pick what to gift." }, { status: 400 });

  // Create the intent (server prices + resolves the recipient).
  const { data: intentId, error: rpcErr } = await supabase.rpc("create_checkout_intent", {
    p_kind: "gift",
    p_bundle_id: bundleId,
    p_gift_ops: opsTag || null,
    p_gift_email: email || null,
    p_gift_message: body.message ?? null,
  });
  if (rpcErr || !intentId) {
    return Response.json({ ok: false, error: rpcErr?.message || "Couldn't start the gift." }, { status: 400 });
  }

  // Read the intent back for the amount + a label (own row via RLS).
  const { data: intent } = await supabase
    .from("checkout_intents")
    .select("tokens, price_eur")
    .eq("id", intentId as string)
    .maybeSingle();
  if (!intent) return Response.json({ ok: false, error: "Couldn't start the gift." }, { status: 400 });

  const origin = req.headers.get("origin") || new URL(req.url).origin;
  const tokens = Number(intent.tokens);
  const label = `Gift: ${tokens} LaserOps game token${tokens === 1 ? "" : "s"}`;

  try {
    const { url } = await provider.createCheckout({
      amountCents: toCents(Number(intent.price_eur)),
      currency: "eur",
      label,
      successUrl: `${origin}/player-portal/store?gifted=1`,
      cancelUrl: `${origin}/player-portal/store`,
      customerEmail: account.email,
      purpose: "token_bundle",
      matchId: String(intentId),
      accountId: account.id,
    });
    return Response.json({ ok: true, url });
  } catch (err) {
    console.error("[store/gift] payment error:", err);
    return Response.json({ ok: false, error: "Couldn't start checkout. Please try again." }, { status: 502 });
  }
}
