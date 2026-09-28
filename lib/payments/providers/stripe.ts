/**
 * lib/payments/providers/stripe.ts
 * --------------------------------------------------------------------
 * Stripe implementation of PaymentProvider. Wraps the low-level REST helpers in
 * lib/stripe.ts. Hosted Checkout Session for checkout; refunds by payment_intent;
 * webhook = signature-verified checkout.session.completed.
 */
import type { PaymentProvider, CheckoutInput, PaymentEvent } from "@/lib/payments/provider";
import { getStripeKeys, createCheckoutSession, createRefund, verifyStripeSignature } from "@/lib/stripe";

export const stripeProvider: PaymentProvider = {
  id: "stripe",

  isConfigured() {
    return Boolean(getStripeKeys().secret);
  },

  async createCheckout(input: CheckoutInput) {
    const params: Record<string, string> = {
      mode: "payment",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.accountId,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": input.currency,
      "line_items[0][price_data][unit_amount]": String(input.amountCents),
      "line_items[0][price_data][product_data][name]": input.label,
      "metadata[match_id]": input.matchId,
      "metadata[account_id]": input.accountId,
      "metadata[purpose]": input.purpose ?? "match",
    };
    if (input.policyText) params["custom_text[submit][message]"] = input.policyText;
    if (input.customerEmail) params.customer_email = input.customerEmail;
    const session = await createCheckoutSession(params);
    return { url: session.url, ref: session.id };
  },

  async refund(ref: string, amountCents?: number) {
    return createRefund(ref, amountCents);
  },

  async parseWebhook(payload: string, headers: Headers): Promise<PaymentEvent> {
    const { webhookSecret } = getStripeKeys();
    if (!webhookSecret) throw new Error("Stripe webhook secret not configured.");
    if (!verifyStripeSignature(payload, headers.get("stripe-signature"), webhookSecret)) {
      throw new Error("Invalid signature.");
    }
    let event: { type?: string; data?: { object?: Record<string, unknown> } };
    try {
      event = JSON.parse(payload);
    } catch {
      throw new Error("Bad payload.");
    }
    if (event.type !== "checkout.session.completed") return { kind: "ignored" };
    const s = (event.data?.object ?? {}) as {
      payment_status?: string;
      amount_total?: number;
      payment_intent?: string;
      metadata?: { match_id?: string; account_id?: string; purpose?: string };
    };
    if (s.payment_status !== "paid" || !s.metadata?.match_id || !s.metadata?.account_id) {
      return { kind: "ignored" };
    }
    return {
      kind: "paid",
      purpose: s.metadata.purpose === "token_bundle" ? "token_bundle" : "match",
      matchId: s.metadata.match_id,
      accountId: s.metadata.account_id,
      amountCents: typeof s.amount_total === "number" ? s.amount_total : null,
      ref: typeof s.payment_intent === "string" ? s.payment_intent : null,
    };
  },
};
