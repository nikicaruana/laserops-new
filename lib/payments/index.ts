/**
 * lib/payments/index.ts
 * --------------------------------------------------------------------
 * Provider registry + selection. `getPaymentProvider()` returns the ACTIVE
 * provider for new checkouts (PAYMENT_PROVIDER env, else the first configured).
 * `getProviderById()` returns a specific provider so an existing payment is
 * always refunded via the processor that captured it.
 */
import type { PaymentProvider } from "@/lib/payments/provider";
import { vivaProvider } from "@/lib/payments/providers/viva";

const PROVIDERS: Record<string, PaymentProvider> = {
  viva: vivaProvider,
};

export function getProviderById(id: string | null | undefined): PaymentProvider | null {
  return id ? PROVIDERS[id] ?? null : null;
}

export function getPaymentProvider(): PaymentProvider | null {
  const pref = (process.env.PAYMENT_PROVIDER || "").toLowerCase();
  if (pref && PROVIDERS[pref]?.isConfigured()) return PROVIDERS[pref];
  if (vivaProvider.isConfigured()) return vivaProvider;
  return null;
}

export type { PaymentProvider, CheckoutInput, PaymentEvent } from "@/lib/payments/provider";
export { REFUND_POLICY, AUTO_REFUND_HOURS, NO_REFUND_HOURS } from "@/lib/payments/policy";
