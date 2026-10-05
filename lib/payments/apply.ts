/**
 * lib/payments/apply.ts
 * --------------------------------------------------------------------
 * Applies a normalised "paid" PaymentEvent to a signup (provider-agnostic).
 * Idempotent (only fills an empty paid_at). Writes with the service role and
 * emits the payment_confirmed notification on first mark. Shared by every
 * provider's webhook route.
 */
import { createServiceClient } from "@/lib/supabase/service";
import { emitNotification } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import type { PaymentEvent } from "@/lib/payments/provider";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.laseropsmalta.com";

export async function markSignupPaid(providerId: string, ev: Extract<PaymentEvent, { kind: "paid" }>): Promise<boolean> {
  const svc = createServiceClient();
  if (!svc) {
    console.error("[payments] SUPABASE_SERVICE_ROLE_KEY missing - cannot mark paid.");
    return false;
  }
  const amount = ev.amountCents != null ? ev.amountCents / 100 : null;
  const update: Record<string, unknown> = {
    paid_at: new Date().toISOString(),
    paid_amount_eur: amount,
    payment_intent: "online",
    payment_ref: ev.ref,
    payment_provider: providerId,
  };

  const { data, error } = await svc
    .from("match_signups")
    .update(update)
    .eq("match_id", ev.matchId)
    .eq("account_id", ev.accountId)
    .is("paid_at", null)
    .select("id");

  if (error) {
    console.error("[payments] mark-paid failed:", error.message);
    return false;
  }
  if (data && data.length > 0) {
    // Money in -> record it in the financial ledger (single source of truth).
    // Do not let a ledger hiccup swallow the confirmation silently - log it so a
    // missing entry is visible (the payment itself is already marked paid above).
    const { error: ledgerErr } = await svc.from("financial_entries").insert({
      direction: "payment",
      category: "game",
      amount_eur: amount ?? 0,
      method: "online",
      account_id: ev.accountId,
      match_id: ev.matchId,
      source: "game_online",
      source_ref: ev.ref,
      note: "Online game payment",
    });
    if (ledgerErr) console.error("[payments] ledger insert failed (game payment):", ledgerErr.message);
    const { data: match } = await svc.from("matches").select("title, match_code").eq("id", ev.matchId).maybeSingle();
    const matchLabel = (match?.title as string) || (match?.match_code as string) || "your game";
    await emitNotification(svc, ev.accountId, "payment_confirmed", {
      title: "Payment confirmed",
      body: `Your payment for ${matchLabel} is confirmed. See you on the field.`,
      href: `/player-portal/games/${ev.matchId}`,
      data: { matchLabel },
    });
    return true;
  }
  return false;
}

/**
 * Fulfils a paid token checkout (bundle or gift). ev.matchId carries the
 * checkout_intents id. The fulfill_checkout_intent RPC (service role, the only
 * writer of token lots) atomically records the buyer's paid purchase + the money
 * ledger row and delivers the tokens, returning a descriptor of what to notify /
 * email. Idempotent - a re-delivered webhook returns { already: true }.
 */
export async function fulfillTokenCheckout(providerId: string, ev: Extract<PaymentEvent, { kind: "paid" }>): Promise<boolean> {
  const svc = createServiceClient();
  if (!svc) {
    console.error("[payments] SUPABASE_SERVICE_ROLE_KEY missing - cannot fulfil checkout.");
    return false;
  }
  const { data: res, error } = await svc.rpc("fulfill_checkout_intent", {
    p_intent_id: ev.matchId,
    p_provider: providerId,
    p_ref: ev.ref,
  });
  if (error) {
    console.error("[payments] fulfill_checkout_intent failed:", error.message);
    return false;
  }
  const r = (res ?? {}) as {
    ok?: boolean;
    already?: boolean;
    kind?: string;
    buyer?: string;
    tokens?: number;
    recipient_account?: string;
    recipient_email?: string;
    claim_code?: string;
    message?: string | null;
  };
  if (!r.ok || r.already) return Boolean(r.ok);

  const tokens = Number(r.tokens ?? 0);
  const tokenWord = tokens === 1 ? "token" : "tokens";

  if (r.kind === "bundle") {
    await emitNotification(svc, r.buyer as string, "tokens_granted", {
      title: "Game tokens added",
      body: `${tokens} LaserOps game ${tokenWord} are now on your account.`,
      href: `/player-portal/profile`,
    });
  } else if (r.kind === "gift_direct") {
    // Recipient has an account: in-app notification + email (via dispatch cron).
    const { data: buyer } = await svc.from("accounts").select("ops_tag").eq("id", r.buyer as string).maybeSingle();
    const from = buyer?.ops_tag ? `${buyer.ops_tag}` : "A fellow player";
    await emitNotification(svc, r.recipient_account as string, "tokens_gifted", {
      data: { gifterName: from },
      title: `${from} sent you ${tokens} game ${tokenWord}`,
      body: `${from} gifted you ${tokens} LaserOps game ${tokenWord}.${r.message ? ` "${r.message}"` : ""} They're on your account now. Use them to pay for a game.`,
      href: `/player-portal/profile`,
    });
    // Buyer confirmation.
    await notifyBuyer(svc, r.buyer as string, tokens, tokenWord);
  } else if (r.kind === "gift_email") {
    // Recipient has no account yet: email a claim link.
    const claimLink = `${BASE_URL}/player-portal/claim?code=${r.claim_code}`;
    const { data: buyer } = await svc.from("accounts").select("ops_tag").eq("id", r.buyer as string).maybeSingle();
    const from = buyer?.ops_tag ? `${buyer.ops_tag}` : "A fellow player";
    await sendEmail({
      to: r.recipient_email as string,
      subject: "You have been gifted LaserOps game tokens",
      typeKey: "tokens_gifted",
      data: { gifterName: from },
      title: `${from} sent you ${tokens} game ${tokenWord}`,
      body: `${from} gifted you ${tokens} LaserOps game ${tokenWord} (1 token = 1 free game).${r.message ? ` Their message: "${r.message}"` : ""} Create your LaserOps account or sign in, then open the link below to claim them.`,
      link: claimLink,
    });
    await notifyBuyer(svc, r.buyer as string, tokens, tokenWord);
  }
  return true;
}

async function notifyBuyer(
  svc: ReturnType<typeof createServiceClient>,
  buyerId: string,
  tokens: number,
  tokenWord: string,
): Promise<void> {
  if (!svc) return;
  const { data: buyer } = await svc.from("accounts").select("email, ops_tag").eq("id", buyerId).maybeSingle();
  if (!buyer?.email) return;
  await sendEmail({
    to: buyer.email,
    subject: "Your LaserOps gift is on its way",
    opsTag: buyer.ops_tag,
    rawHtml: `<p>Thanks for your purchase. Your gift of ${tokens} LaserOps game ${tokenWord} has been sent to the recipient. 1 token = 1 free game.</p>`,
  });
}
