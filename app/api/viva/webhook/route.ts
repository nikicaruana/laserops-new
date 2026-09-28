/**
 * app/api/viva/webhook/route.ts
 * --------------------------------------------------------------------
 * Viva.com webhook. GET answers Viva's verification challenge with { Key }; POST
 * parses the event (which re-fetches the transaction from Viva to confirm it is
 * paid) and applies it via markSignupPaid. Inert until Viva env is configured.
 */
import type { NextRequest } from "next/server";
import { vivaProvider } from "@/lib/payments/providers/viva";
import { markSignupPaid, fulfillTokenCheckout } from "@/lib/payments/apply";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const body = vivaProvider.webhookChallenge ? await vivaProvider.webhookChallenge(new URL(req.url)) : null;
  if (!body) return Response.json({ ok: false, error: "Not configured." }, { status: 500 });
  return Response.json(body);
}

export async function POST(req: NextRequest) {
  const payload = await req.text();
  let ev;
  try {
    ev = await vivaProvider.parseWebhook(payload, req.headers);
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Invalid webhook." }, { status: 400 });
  }
  if (ev.kind === "paid") {
    if (ev.purpose === "token_bundle") await fulfillTokenCheckout("viva", ev);
    else await markSignupPaid("viva", ev);
  }
  return Response.json({ received: true });
}
