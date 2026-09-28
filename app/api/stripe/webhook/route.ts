/**
 * app/api/stripe/webhook/route.ts
 * --------------------------------------------------------------------
 * Stripe webhook. Delegates signature verification + parsing to the Stripe
 * payment provider and applies the normalised "paid" event via markSignupPaid.
 * Public route; the signature check inside parseWebhook is the auth.
 */
import type { NextRequest } from "next/server";
import { stripeProvider } from "@/lib/payments/providers/stripe";
import { markSignupPaid, fulfillTokenCheckout } from "@/lib/payments/apply";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const payload = await req.text();
  let ev;
  try {
    ev = await stripeProvider.parseWebhook(payload, req.headers);
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Invalid webhook." }, { status: 400 });
  }
  if (ev.kind === "paid") {
    if (ev.purpose === "token_bundle") await fulfillTokenCheckout("stripe", ev);
    else await markSignupPaid("stripe", ev);
  }
  return Response.json({ received: true });
}
