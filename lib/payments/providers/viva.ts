/**
 * lib/payments/providers/viva.ts
 * --------------------------------------------------------------------
 * Viva.com (Smart Checkout) implementation of PaymentProvider. No SDK - REST via
 * fetch, same pattern as the Stripe/Cloudinary/Resend usage.
 *
 * Flow (https://developer.viva.com/smart-checkout/):
 *   1. OAuth2 client-credentials -> bearer token (scope redirectcheckout).
 *   2. POST /checkout/v2/orders -> orderCode.
 *   3. Redirect the customer to the hosted Smart Checkout with ?ref=orderCode.
 *   4. Viva webhook ("Transaction Payment Created") POSTs the transactionId; we
 *      RETRIEVE the transaction from Viva to confirm it's paid (never trust the
 *      unsigned POST) before marking the signup paid.
 *   5. Refund = "Cancel transaction" (DELETE /api/transactions/{id}), partial via
 *      ?amount=cents.
 *
 * Env: VIVA_ENV ("demo"|"production"), VIVA_CLIENT_ID, VIVA_CLIENT_SECRET
 *      (OAuth), VIVA_MERCHANT_ID, VIVA_API_KEY (Basic auth for refunds + webhook
 *      key), VIVA_SOURCE_CODE (payment source).
 *
 * Field names + webhook shape below are confirmed against Viva's public docs
 * (retrieve-transaction returns statusId/amount/merchantTrns; the "Transaction
 * Payment Created" webhook is EventTypeId 1796 with EventData.TransactionId/
 * MerchantTrns/Amount). A live sandbox smoke test is the final check.
 */
import type { PaymentProvider, CheckoutInput, PaymentEvent } from "@/lib/payments/provider";

function env() {
  const demo = (process.env.VIVA_ENV || "demo") !== "production";
  return {
    demo,
    accounts: demo ? "https://demo-accounts.vivapayments.com" : "https://accounts.viva.com",
    api: demo ? "https://demo-api.vivapayments.com" : "https://api.vivapayments.com",
    // Legacy native API (Basic auth): refunds + webhook verification key live on
    // the SELFCARE host, NOT the -api host used for OAuth /checkout/v2.
    basicApi: demo ? "https://demo.vivapayments.com" : "https://www.vivapayments.com",
    checkout: demo ? "https://demo.vivapayments.com/web/checkout" : "https://www.vivapayments.com/web/checkout",
    clientId: process.env.VIVA_CLIENT_ID || "",
    clientSecret: process.env.VIVA_CLIENT_SECRET || "",
    merchantId: process.env.VIVA_MERCHANT_ID || "",
    apiKey: process.env.VIVA_API_KEY || "",
    sourceCode: process.env.VIVA_SOURCE_CODE || "",
  };
}

function basic(user: string, pass: string) {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}

async function oauthToken(): Promise<string> {
  const e = env();
  const res = await fetch(`${e.accounts}/connect/token`, {
    method: "POST",
    headers: { Authorization: basic(e.clientId, e.clientSecret), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!res.ok || !data.access_token) throw new Error(data.error || "Viva OAuth failed.");
  return data.access_token;
}

/** Retrieve a transaction to confirm it is paid (statusId "F" = finished/success). */
async function retrieveTransaction(token: string, transactionId: string): Promise<{ paid: boolean; amountCents: number | null; merchantTrns: string | null }> {
  const e = env();
  // GET /checkout/v2/transactions/{id} (Bearer). Returns statusId ("F" = paid),
  // amount in MAJOR units (euros, e.g. 21.1 -> the *100 below yields cents),
  // merchantTrns, orderCode. Confirmed against Viva docs.
  const res = await fetch(`${e.api}/checkout/v2/transactions/${transactionId}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error("Viva transaction lookup failed.");
  const t = (await res.json()) as { statusId?: string; amount?: number; merchantTrns?: string };
  return {
    paid: t.statusId === "F",
    amountCents: typeof t.amount === "number" ? Math.round(t.amount * 100) : null,
    merchantTrns: t.merchantTrns ?? null,
  };
}

export const vivaProvider: PaymentProvider = {
  id: "viva",

  isConfigured() {
    const e = env();
    return Boolean(e.clientId && e.clientSecret);
  },

  async createCheckout(input: CheckoutInput) {
    const e = env();
    const token = await oauthToken();
    // merchantTrns carries our ids back on the webhook.
    const body: Record<string, unknown> = {
      amount: input.amountCents,
      customerTrns: input.label,
      customer: input.customerEmail ? { email: input.customerEmail } : undefined,
      paymentTimeout: 1800,
      preauth: false,
      allowRecurring: false,
      merchantTrns: `${input.purpose ?? "match"}:${input.matchId}:${input.accountId}`,
      sourceCode: e.sourceCode || undefined,
      // Success/failure return URLs live on the payment SOURCE in the Viva
      // console (not per-order). On success Viva redirects there with
      // ?t={transactionId}&s={orderCode} appended; the webhook is what actually
      // confirms payment. Point the Source success URL at /checkout/complete.
    };
    const res = await fetch(`${e.api}/checkout/v2/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json()) as { orderCode?: number | string; message?: string };
    if (!res.ok || data.orderCode == null) throw new Error(data.message || "Viva order creation failed.");
    return { url: `${e.checkout}?ref=${data.orderCode}`, ref: String(data.orderCode) };
  },

  async refund(ref: string, amountCents?: number) {
    const e = env();
    // Cancel transaction (refund). Basic auth with merchant id + api key. Viva
    // REQUIRES the amount (cents) even for a full refund - omitting it is
    // rejected - so when the caller passes none, retrieve the txn amount first.
    let cents = amountCents;
    if (cents == null) {
      const token = await oauthToken();
      const tx = await retrieveTransaction(token, ref);
      cents = tx.amountCents ?? undefined;
    }
    const qs = cents != null ? `?amount=${cents}` : "";
    const res = await fetch(`${e.basicApi}/api/transactions/${ref}${qs}`, {
      method: "DELETE",
      headers: { Authorization: basic(e.merchantId, e.apiKey) },
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => ({}))) as { Success?: boolean; TransactionId?: string; ErrorText?: string };
    if (!res.ok || data.Success === false) throw new Error(data.ErrorText || "Viva refund failed.");
    return { id: data.TransactionId || ref, status: "refunded" };
  },

  async parseWebhook(payload: string): Promise<PaymentEvent> {
    let body: { EventTypeId?: number; EventData?: { TransactionId?: string; MerchantTrns?: string; Amount?: number } };
    try {
      body = JSON.parse(payload);
    } catch {
      throw new Error("Bad payload.");
    }
    // 1796 = Transaction Payment Created (a successful sale); EventTypeId +
    // EventData field names confirmed against Viva docs.
    const txId = body.EventData?.TransactionId;
    if (body.EventTypeId !== 1796 || !txId) return { kind: "ignored" };

    // Never trust the unsigned POST: retrieve the transaction to confirm it's paid.
    const token = await oauthToken();
    const tx = await retrieveTransaction(token, txId);
    const merchantTrns = tx.merchantTrns || body.EventData?.MerchantTrns || "";
    // "purpose:matchId:accountId" (new) or legacy "matchId:accountId".
    const parts = merchantTrns.split(":");
    const purpose = parts.length >= 3 && parts[0] === "token_bundle" ? "token_bundle" : "match";
    const [matchId, accountId] = parts.length >= 3 ? [parts[1], parts[2]] : [parts[0], parts[1]];
    if (!tx.paid || !matchId || !accountId) return { kind: "ignored" };
    return { kind: "paid", purpose, matchId, accountId, amountCents: tx.amountCents, ref: txId };
  },

  async webhookChallenge() {
    // Viva verifies a new webhook by GETting the URL and expecting { Key }.
    const e = env();
    const res = await fetch(`${e.basicApi}/api/messages/config/token`, {
      headers: { Authorization: basic(e.merchantId, e.apiKey) },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { Key?: string };
    return data.Key ? { Key: data.Key } : null;
  },
};

/**
 * Diagnostic used by /api/admin/viva-check. Reports config presence and live
 * connectivity WITHOUT leaking any secret value, so the sandbox bring-up (once
 * the demo keys are set) is a single click with clear pass/fail per step.
 */
export async function vivaSelfTest(): Promise<{
  ok: boolean;
  env: string;
  active: boolean;
  present: Record<string, boolean>;
  missing: string[];
  oauth: { ok: boolean; error?: string };
  webhookKey: { ok: boolean; error?: string };
}> {
  const e = env();
  const present = {
    VIVA_CLIENT_ID: Boolean(e.clientId),
    VIVA_CLIENT_SECRET: Boolean(e.clientSecret),
    VIVA_MERCHANT_ID: Boolean(e.merchantId),
    VIVA_API_KEY: Boolean(e.apiKey),
    VIVA_SOURCE_CODE: Boolean(e.sourceCode),
  };
  const missing = Object.entries(present).filter(([, v]) => !v).map(([k]) => k);
  const active = (process.env.PAYMENT_PROVIDER || "").toLowerCase() === "viva";

  // OAuth token: the credential that gates order creation.
  const oauth: { ok: boolean; error?: string } = { ok: false };
  if (present.VIVA_CLIENT_ID && present.VIVA_CLIENT_SECRET) {
    try {
      await oauthToken();
      oauth.ok = true;
    } catch (err) {
      oauth.error = err instanceof Error ? err.message : "OAuth failed.";
    }
  } else {
    oauth.error = "Client id / secret not set.";
  }

  // Webhook verification key (Basic auth: merchant id + api key). Its presence is
  // what lets the webhook answer Vivas GET challenge on registration.
  const webhookKey: { ok: boolean; error?: string } = { ok: false };
  if (present.VIVA_MERCHANT_ID && present.VIVA_API_KEY) {
    try {
      const body = await vivaProvider.webhookChallenge!(new URL("https://example.com"));
      const key = body && (body as { Key?: string }).Key;
      webhookKey.ok = Boolean(key);
      if (!key) webhookKey.error = "No webhook key returned - check merchant id + api key.";
    } catch (err) {
      webhookKey.error = err instanceof Error ? err.message : "Webhook-key lookup failed.";
    }
  } else {
    webhookKey.error = "Merchant id / api key not set.";
  }

  const ok = missing.length === 0 && oauth.ok && webhookKey.ok;
  return { ok, env: e.demo ? "demo" : "production", active, present, missing, oauth, webhookKey };
}
