/**
 * app/api/checkout/[matchId]/route.ts
 * --------------------------------------------------------------------
 * Starts a hosted-checkout session for a signed-up player to pay their
 * per-player match fee online. Auth-gated to the player; requires the match to
 * be confirmed/live, per-player priced, and the caller to hold a registered
 * signup that isn't already paid. Records payment_intent = 'online' and returns
 * the Checkout URL. Payment is confirmed asynchronously by the provider webhook
 * (which is the only thing that sets paid_at). Returns { ok, url }.
 */
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPaymentProvider } from "@/lib/payments";
import { getRefundConfig } from "@/lib/payments/refund-config";
import { toCents } from "@/lib/money";
import { createServiceClient } from "@/lib/supabase/service";
import { markSignupPaid } from "@/lib/payments/apply";

export async function POST(req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const provider = getPaymentProvider();
  if (!provider) {
    return Response.json({ ok: false, error: "Online payment isn't set up yet." }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const { data: account } = await supabase.from("accounts").select("id, email, full_name, ops_tag, discount_price_eur").eq("auth_user_id", user.id).maybeSingle();
  if (!account) return Response.json({ ok: false, error: "No account found." }, { status: 400 });

  const { data: match } = await supabase
    .from("matches")
    .select("id, status, price_eur, pricing_mode, title, match_code")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return Response.json({ ok: false, error: "Game not found." }, { status: 404 });
  if (match.status !== "confirmed" && match.status !== "live") {
    return Response.json({ ok: false, error: "This game isn't open for payment." }, { status: 400 });
  }
  if (match.pricing_mode !== "per_player" || !match.price_eur || Number(match.price_eur) <= 0) {
    return Response.json({ ok: false, error: "This game has no online price." }, { status: 400 });
  }

  const { data: signup } = await supabase
    .from("match_signups")
    .select("status, paid_at")
    .eq("match_id", matchId)
    .eq("account_id", account.id)
    .maybeSingle();
  if (!signup || signup.status !== "registered") {
    return Response.json({ ok: false, error: "You're not signed up to this game." }, { status: 400 });
  }
  if (signup.paid_at) {
    return Response.json({ ok: false, error: "You've already paid for this game." }, { status: 400 });
  }

  // Any tokens already applied to this game reduce the online charge (1 token =
  // the full game). Read from the ledger (players can't write it), so a forged
  // client value can't discount the price. remaining = price * (1 - applied).
  const { data: tokenTx } = await supabase
    .from("token_transactions")
    .select("delta")
    .eq("match_id", matchId)
    .eq("account_id", account.id)
    .eq("kind", "spend");
  const applied = (tokenTx ?? []).reduce((s, r) => s + -Number(r.delta), 0);
  const remainderFraction = Math.max(0, 1 - applied);
  if (remainderFraction <= 0.0001) {
    return Response.json({ ok: false, error: "This game is already covered by your tokens." }, { status: 400 });
  }
  // Family & friends players pay a hard-coded price instead of the game's price.
  const basePrice = account.discount_price_eur != null ? Number(account.discount_price_eur) : Number(match.price_eur);
  const amountCents = toCents(basePrice * remainderFraction);

  // A 100% discount (or a discount that rounds the fee to nothing) means there is
  // nothing to charge — comp the place directly instead of opening a checkout.
  if (amountCents <= 0) {
    const svc = createServiceClient();
    if (svc) await markSignupPaid("comp", { kind: "paid", purpose: "match", matchId: match.id, accountId: account.id, amountCents: 0, ref: null });
    return Response.json({ ok: true, url: `${req.headers.get("origin") || new URL(req.url).origin}/player-portal/games/${matchId}?paid=1`, free: true });
  }

  // Record the intent up front (a legitimate, player-writable column) so it
  // sticks even if they abandon checkout. paid_at stays untouched (webhook only).
  await supabase.from("match_signups").update({ payment_intent: "online" }).eq("match_id", matchId).eq("account_id", account.id);

  const origin = req.headers.get("origin") || new URL(req.url).origin;
  const baseLabel = match.title || match.match_code || "LaserOps game";
  const label = applied > 0 ? `${baseLabel} (part-paid with ${applied} token)` : baseLabel;

  const policyText = (await getRefundConfig()).policyText;

  // Retry once: Viva checkout creation can fail transiently (an OAuth / order
  // timeout or a momentary provider blip) - exactly the "please try again" case.
  // Absorb it rather than bouncing the player on the first hiccup. The real
  // provider error is logged server-side AND returned as `detail` so an admin
  // can see the exact reason without digging through logs.
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { url } = await provider.createCheckout({
        amountCents,
        currency: "eur",
        label,
        successUrl: `${origin}/player-portal/games/${matchId}?paid=1`,
        cancelUrl: `${origin}/player-portal/games/${matchId}`,
        customerEmail: account.email,
        customerName: account.full_name || account.ops_tag || null,
        matchId: match.id,
        accountId: account.id,
        policyText,
      });
      return Response.json({ ok: true, url });
    } catch (err) {
      lastErr = err;
      console.error(`[checkout] payment error (attempt ${attempt}/2, match ${match.id}, account ${account.id}):`, err);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 500));
    }
  }
  return Response.json(
    { ok: false, error: "Couldn't start checkout. Please try again in a moment.", detail: lastErr instanceof Error ? lastErr.message : String(lastErr) },
    { status: 502 },
  );
}
