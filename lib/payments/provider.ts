/**
 * lib/payments/provider.ts
 * --------------------------------------------------------------------
 * Provider-agnostic payment contract. The booking/refund logic talks to this
 * interface; concrete providers (Viva) implement it, so
 * switching processors is a contained adapter swap. All amounts are in minor
 * units (cents). Server-only.
 */
/**
 * What a checkout is for. "match" = a per-player game fee (matchId holds the
 * match). "token_bundle" = a store bundle purchase (matchId holds the
 * token_purchases id). The webhook routes on this so one provider + one webhook
 * serves both. Defaults to "match" when a provider can't read it back.
 */
export type CheckoutPurpose = "match" | "token_bundle";

export type CheckoutInput = {
  amountCents: number;
  currency: string; // ISO, lower-case e.g. "eur"
  /** Human label for the line item / checkout page. */
  label: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | null;
  /** Payer's name, attached to the provider order so it shows in the provider dashboard. */
  customerName?: string | null;
  /** Carried through the provider back to the webhook. For "match" it's the match id; for "token_bundle" it's the token_purchases id. */
  matchId: string;
  accountId: string;
  /** Defaults to "match" when omitted. */
  purpose?: CheckoutPurpose;
  /** Refund terms shown on the hosted checkout, where supported. */
  policyText?: string;
};

/** Normalised webhook outcome the app cares about. */
export type PaymentEvent =
  | { kind: "paid"; purpose: CheckoutPurpose; matchId: string; accountId: string; amountCents: number | null; ref: string | null }
  | { kind: "ignored" };

export interface PaymentProvider {
  /** Stable id stored on the signup (e.g. "viva"). */
  readonly id: string;
  /** Whether the required env/credentials are present. */
  isConfigured(): boolean;
  /** Start a hosted checkout; returns the redirect URL (and provider ref if known up front). */
  createCheckout(input: CheckoutInput): Promise<{ url: string; ref?: string | null }>;
  /** Refund a captured payment by its stored ref; full, or `amountCents` for partial. */
  refund(ref: string, amountCents?: number): Promise<{ id: string; status: string }>;
  /** Verify + parse an incoming webhook into a PaymentEvent. */
  parseWebhook(payload: string, headers: Headers): Promise<PaymentEvent>;
  /**
   * Optional webhook verification challenge (some providers, e.g. Viva, answer a
   * GET on the webhook URL with a token). Return the JSON body to respond with,
   * or null if the provider doesn't use one.
   */
  webhookChallenge?(url: URL): Promise<unknown | null>;
}
