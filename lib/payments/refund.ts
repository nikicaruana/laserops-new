/**
 * lib/payments/refund.ts
 * --------------------------------------------------------------------
 * One place that refunds a paid signup, so every path (admin single refund,
 * player drop-out, whole-match cancellation, admin early-end) behaves the same.
 *
 * A player can pay for a game with cash (online), tokens, or a mix. A refund
 * returns a fraction (1 = full) of what they paid, CASH FIRST then tokens:
 *   - cash portion  -> refunded via the provider that captured it (Viva/Stripe)
 *                      and logged to the financial ledger,
 *   - token portion -> credited back as a 'refund' token lot (refund_match_tokens).
 * It writes the signup's refund bookkeeping and emits the `refunded`
 * notification with a body stating BOTH amounts. Idempotent per signup: a signup
 * already carrying refunded_at is skipped, so a re-run never double-refunds.
 *
 * All amounts are EUR unless noted; tokens are in token units (1 token = 1 game,
 * fractional allowed). Server-only (uses the service client + service-role RPCs).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProviderById } from "@/lib/payments";
import { emitNotification } from "@/lib/notifications";
import { toCents } from "@/lib/money";

type Svc = SupabaseClient;

const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

function fmtTokens(n: number): string {
  return Number.isInteger(n) ? String(n) : String(r4(n));
}

/** Human "€X and N game tokens for <game>" line for the refunded notification / email. */
export function refundBody(cashEur: number, tokens: number, matchLabel?: string): string {
  const parts: string[] = [];
  if (cashEur > 0) parts.push(`€${cashEur.toFixed(2)}`);
  if (tokens > 0) parts.push(`${fmtTokens(tokens)} game token${tokens === 1 ? "" : "s"}`);
  const what = parts.length > 0 ? parts.join(" and ") : "your payment";
  const forGame = matchLabel ? ` for ${matchLabel}` : "";
  return `We've refunded ${what}${forGame} to your account.`;
}

export type RefundOutcome = {
  ok: boolean;
  accountId: string;
  cashEur: number;
  tokens: number;
  /** Set when nothing was done (not paid / already refunded / nothing owed). */
  skipped?: string;
  error?: string;
};

/**
 * Refund one signup by `fraction` (0..1, default 1 = full), cash first.
 * Pass `price`/`matchLabel` to avoid re-reading the match when batching.
 */
export async function refundSignup(
  svc: Svc,
  matchId: string,
  accountId: string,
  opts: { fraction?: number; note?: string; matchLabel?: string; price?: number } = {},
): Promise<RefundOutcome> {
  const fraction = Math.min(1, Math.max(0, opts.fraction ?? 1));
  const base: RefundOutcome = { ok: false, accountId, cashEur: 0, tokens: 0 };

  const { data: signup } = await svc
    .from("match_signups")
    .select("paid_at, paid_amount_eur, payment_ref, payment_provider, stripe_payment_intent, refunded_at")
    .eq("match_id", matchId)
    .eq("account_id", accountId)
    .maybeSingle();
  if (!signup) return { ...base, skipped: "no signup" };
  if (!signup.paid_at) return { ...base, ok: true, skipped: "not paid" };
  if (signup.refunded_at) return { ...base, ok: true, skipped: "already refunded" };

  let price = opts.price;
  let matchLabel = opts.matchLabel;
  if (price == null || matchLabel == null) {
    const { data: m } = await svc.from("matches").select("price_eur, title, match_code").eq("id", matchId).maybeSingle();
    if (price == null) price = Number(m?.price_eur ?? 0);
    if (matchLabel == null) matchLabel = (m?.title as string) || (m?.match_code as string) || "your game";
  }

  // Token portion the player spent on this game (kind='spend', delta negative).
  const { data: spends } = await svc
    .from("token_transactions")
    .select("delta")
    .eq("match_id", matchId)
    .eq("account_id", accountId)
    .eq("kind", "spend");
  const tokensSpent = (spends ?? []).reduce((s, row) => s + -Number((row as { delta: number }).delta), 0);

  const cashPaid = Number(signup.paid_amount_eur ?? 0);
  const tokenValueEur = tokensSpent * (price ?? 0);
  const totalEur = r2(cashPaid + tokenValueEur);
  if (totalEur <= 0) return { ...base, ok: true, skipped: "nothing to refund" };

  // Cash first, then tokens for the remainder.
  const refundEur = r2(totalEur * fraction);
  const cashRefundEur = r2(Math.min(cashPaid, refundEur));
  const remainderEur = r2(refundEur - cashRefundEur);
  const tokenRefund = price && price > 0 ? r4(remainderEur / price) : 0;

  const providerId = signup.payment_provider || (signup.stripe_payment_intent ? "stripe" : null);
  const ref = signup.payment_ref || signup.stripe_payment_intent;
  const note = opts.note ?? "Game refund";

  // 1) Cash portion via the capturing provider + ledger entry.
  if (cashRefundEur > 0 && providerId && ref) {
    const provider = getProviderById(providerId);
    if (!provider) return { ...base, error: `Unknown payment provider (${providerId}).` };
    try {
      await provider.refund(ref, toCents(cashRefundEur));
    } catch (err) {
      return { ...base, error: err instanceof Error ? err.message : "Provider refund failed." };
    }
    const { error: le } = await svc.from("financial_entries").insert({
      direction: "refund",
      category: "game",
      amount_eur: cashRefundEur,
      method: "online",
      account_id: accountId,
      match_id: matchId,
      source: "game_online",
      source_ref: ref,
      note,
    });
    if (le) console.error("[refund] ledger insert failed:", le.message);
  }

  // 2) Token portion credited back (service-role safe RPC).
  if (tokenRefund > 0) {
    const { error: te } = await svc.rpc("refund_match_tokens", {
      p_acct: accountId,
      p_amount: tokenRefund,
      p_match_id: matchId,
      p_note: note,
    });
    if (te) console.error("[refund] token credit failed:", te.message);
  }

  // 3) Signup bookkeeping. A full refund clears paid_at (they're no longer paid);
  //    a partial (early-end) keeps it — they attended and only got some money back.
  const isFull = fraction >= 0.999;
  const upd: Record<string, unknown> = {
    refunded_at: new Date().toISOString(),
    refunded_amount_eur: refundEur,
    refund_status: "refunded",
  };
  if (isFull) upd.paid_at = null;
  await svc.from("match_signups").update(upd).eq("match_id", matchId).eq("account_id", accountId);

  // 4) Notify with a body that states both cash + tokens.
  await emitNotification(svc, accountId, "refunded", {
    title: "You have been refunded",
    body: refundBody(cashRefundEur, tokenRefund, matchLabel),
    href: `/player-portal/games/${matchId}`,
    data: { cashEur: cashRefundEur, tokens: tokenRefund, refundEur, matchLabel },
  });

  return { ok: true, accountId, cashEur: cashRefundEur, tokens: tokenRefund };
}

/**
 * Refund every still-paid, not-yet-refunded signup on a match by `fraction`
 * (1 = full, for cancellation; 0.25/0.5/0.75 for an early-end weather refund).
 */
export async function refundAllPaidSignups(
  svc: Svc,
  matchId: string,
  opts: { fraction?: number; note?: string } = {},
): Promise<{ refunded: number; totalCashEur: number; totalTokens: number; errors: string[] }> {
  const { data: m } = await svc.from("matches").select("price_eur, title, match_code").eq("id", matchId).maybeSingle();
  const price = Number(m?.price_eur ?? 0);
  const matchLabel = (m?.title as string) || (m?.match_code as string) || "your game";

  const { data: rows } = await svc
    .from("match_signups")
    .select("account_id")
    .eq("match_id", matchId)
    .not("paid_at", "is", null)
    .is("refunded_at", null);

  let refunded = 0;
  let totalCashEur = 0;
  let totalTokens = 0;
  const errors: string[] = [];
  for (const row of (rows ?? []) as { account_id: string }[]) {
    const res = await refundSignup(svc, matchId, row.account_id, { ...opts, price, matchLabel });
    if (res.error) errors.push(`${row.account_id}: ${res.error}`);
    else if (!res.skipped) {
      refunded += 1;
      totalCashEur = r2(totalCashEur + res.cashEur);
      totalTokens = r4(totalTokens + res.tokens);
    }
  }
  return { refunded, totalCashEur, totalTokens, errors };
}
