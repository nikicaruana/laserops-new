/**
 * lib/payments/index.ts
 * --------------------------------------------------------------------
 * Provider registry + selection. `getPaymentProvider()` returns the ACTIVE
 * provider for new checkouts (PAYMENT_PROVIDER env, else the first configured -
 * Stripe preferred for back-compat). `getProviderById()` returns a specific
 * provider so an existing payment is always refunded via the processor that
 * captured it, even after the active provider changes.
 */
import type { PaymentProvider } from "@/lib/payments/provider";
import { stripeProvider } from "@/lib/payments/providers/stripe";
import { vivaProvider } from "@/lib/payments/providers/viva";

const PROVIDERS: Record<string, PaymentProvider> = {
  stripe: stripeProvider,
  viva: vivaProvider,
};

export function getProviderById(id: string | null | undefined): PaymentProvider | null {
  return id ? PROVIDERS[id] ?? null : null;
}

export function getPaymentProvider(): PaymentProvider | null {
  const pref = (process.env.PAYMENT_PROVIDER || "").toLowerCase();
  if (pref && PROVIDERS[pref]?.isConfigured()) return PROVIDERS[pref];
  if (stripeProvider.isConfigured()) return stripeProvider;
  if (vivaProvider.isConfigured()) return vivaProvider;
  return null;
}

export type { PaymentProvider, CheckoutInput, PaymentEvent } from "@/lib/payments/provider";
export { REFUND_POLICY, AUTO_REFUND_HOURS, NO_REFUND_HOURS } from "@/lib/payments/policy";
