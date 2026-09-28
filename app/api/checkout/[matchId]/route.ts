/**
 * app/api/checkout/[matchId]/route.ts
 * --------------------------------------------------------------------
 * Starts a Stripe hosted-checkout session for a signed-up player to pay their
 * per-player match fee online. Auth-gated to the player; requires the match to
 * be confirmed/live, per-player priced, and the caller to hold a registered
 * signup that isn't already paid. Records payment_intent = 'online' and returns
 * the Checkout URL. Payment is confirmed asynchronously by the Stripe webhook
 * (which is the only thing that sets paid_at). Returns { ok, url }.
 */
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPaymentProvider, REFUND_POLICY } from "@/lib/payments";
import { toCents } from "@/lib/money";

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

  const { data: account } = await supabase.from("accounts").select("id, email").eq("auth_user_id", user.id).maybeSingle();
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
  const amountCents = toCents(Number(match.price_eur) * remainderFraction);

  // Record the intent up front (a legitimate, player-writable column) so it
  // sticks even if they abandon checkout. paid_at stays untouched (webhook only).
  await supabase.from("match_signups").update({ payment_intent: "online" }).eq("match_id", matchId).eq("account_id", account.id);

  const origin = req.headers.get("origin") || new URL(req.url).origin;
  const baseLabel = match.title || match.match_code || "LaserOps game";
  const label = applied > 0 ? `${baseLabel} (part-paid with ${applied} token)` : baseLabel;

  try {
    const { url } = await provider.createCheckout({
      amountCents,
      currency: "eur",
      label,
      successUrl: `${origin}/player-portal/games/${matchId}?paid=1`,
      cancelUrl: `${origin}/player-portal/games/${matchId}`,
      customerEmail: account.email,
      matchId: match.id,
      accountId: account.id,
      policyText: REFUND_POLICY,
    });
    return Response.json({ ok: true, url });
  } catch (err) {
    console.error("[checkout] payment error:", err);
    return Response.json({ ok: false, error: "Couldn't start checkout. Please try again." }, { status: 502 });
  }
}
