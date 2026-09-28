/**
 * lib/stripe.ts
 * --------------------------------------------------------------------
 * Minimal Stripe access via the REST API (no SDK) – same no-dependency pattern
 * as lib/cloudinary.ts and the Resend usage. Server-only: reads the secret keys
 * from env and never exposes them. Two helpers: create a hosted Checkout Session
 * and verify an incoming webhook signature.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY       (sk_live_… / sk_test_…)
 *   STRIPE_WEBHOOK_SECRET   (whsec_…, from the webhook endpoint settings)
 */
import crypto from "node:crypto";

export function getStripeKeys() {
  return {
    secret: process.env.STRIPE_SECRET_KEY || null,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || null,
  };
}

/** Create a Checkout Session. `params` uses Stripe's flat bracket keys. */
export async function createCheckoutSession(params: Record<string, string>): Promise<{ id: string; url: string }> {
  const { secret } = getStripeKeys();
  if (!secret) throw new Error("Stripe is not configured.");
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!res.ok || !data.url || !data.id) {
    throw new Error(data?.error?.message || "Stripe checkout failed.");
  }
  return { id: data.id, url: data.url };
}

/** Refund a payment in full (or `amountCents` if given). */
export async function createRefund(paymentIntent: string, amountCents?: number): Promise<{ id: string; status: string }> {
  const { secret } = getStripeKeys();
  if (!secret) throw new Error("Stripe is not configured.");
  const params: Record<string, string> = { payment_intent: paymentIntent };
  if (amountCents != null) params.amount = String(amountCents);
  const res = await fetch("https://api.stripe.com/v1/refunds", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json()) as { id?: string; status?: string; error?: { message?: string } };
  if (!res.ok || !data.id) throw new Error(data?.error?.message || "Refund failed.");
  return { id: data.id, status: data.status ?? "unknown" };
}

/**
 * Verify a Stripe webhook signature (scheme v1). Recomputes HMAC-SHA256 of
 * `${timestamp}.${payload}` with the webhook secret and constant-time compares.
 * Also rejects timestamps older than `toleranceSeconds` (replay guard).
 */
export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 300,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!header) return false;
  const parts: Record<string, string> = {};
  for (const kv of header.split(",")) {
    const i = kv.indexOf("=");
    if (i > 0) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  }
  const t = Number(parts["t"]);
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  if (Math.abs(nowSeconds - t) > toleranceSeconds) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
