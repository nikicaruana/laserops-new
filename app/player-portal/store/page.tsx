/**
 * app/player-portal/store/page.tsx
 * --------------------------------------------------------------------
 * The LaserOps store. Shows the game-token bundles a player can buy. A bundle is
 * a pack of tokens (1 token = 1 free game) that lands on the account after
 * payment. Auth-gated; prices are read from token_bundles (server-authoritative).
 * The game-token coin art (reward_images.game_token, admin-uploaded) is the hero
 * of each bundle card - a stack of overlapping coins, one per token (capped) -
 * and a small coin sits beside the wallet balance.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { BuyBundleButton } from "@/components/portal/BuyBundleButton";
import { GiftTokensButton } from "@/components/portal/GiftTokensButton";
import { createClient } from "@/lib/supabase/server";
import { formatEur } from "@/lib/money";
import { cldImage } from "@/lib/cld";

export const metadata: Metadata = {
  title: "Store",
};

// How many overlapping coins to render for a bundle (visual only; the number
// label states the true count). Capped so big bundles don't overflow the card.
const MAX_COINS = 6;

function fmtTokens(n: number): string {
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(2)));
}

export default async function StorePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/player-portal/login?next=/player-portal/store");

  const [{ data: bundles }, { data: balance }, { data: cfg }, { data: coin }] = await Promise.all([
    supabase
      .from("token_bundles")
      .select("id, name, tokens, price_eur, validity_months")
      .eq("is_active", true)
      .order("sort_order", { ascending: true, nullsFirst: false }),
    supabase.rpc("my_token_balance"),
    supabase.from("token_config").select("single_token_price_eur").eq("id", 1).maybeSingle(),
    supabase.from("reward_images").select("image_url").eq("key", "game_token").maybeSingle(),
  ]);

  const list = bundles ?? [];
  const singleTokenPrice = Number(cfg?.single_token_price_eur ?? 35);
  const coinUrl = coin?.image_url ?? null;
  const coinSrc = coinUrl ? cldImage(coinUrl, { w: 240, trim: true }) : null;
  const giftBundles = list.map((b) => ({ id: b.id, name: b.name, tokens: Number(b.tokens), price_eur: Number(b.price_eur) }));

  return (
    <Container size="narrow" className="py-12 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-center text-2xl font-bold uppercase tracking-[0.12em] text-text sm:text-3xl">Store</h1>
        <p className="mt-3 text-center text-sm text-text-muted">
          Buy game tokens in a bundle and save. 1 token = 1 free game. Tokens land on your account and can be used to pay
          for any game.
        </p>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-1 text-center text-xs text-text-subtle">
          You currently have
          {coinSrc && <img src={coinSrc} alt="" className="inline-block h-4 w-4 object-contain" />}
          <span className="font-semibold text-accent">{fmtTokens(Number(balance ?? 0))}</span>
          {Number(balance ?? 0) === 1 ? "token" : "tokens"}.{" "}
          <Link href="/player-portal/profile" className="underline hover:text-accent">
            View your wallet
          </Link>
        </p>

        <div className="mt-6 border-l-2 border-accent/70 bg-accent/5 px-4 py-3 text-left text-xs leading-relaxed text-text-muted">
          <span className="font-semibold text-text">Before you buy:</span> 1 token = 1 game. Tokens expire after the validity period shown on each bundle, and once expired they can&apos;t be used or refunded. Tokens are non-transferable (except via gifting) and have no cash value. Full terms are below and in our{" "}
          <Link href="/terms" className="underline hover:text-accent">Terms &amp; Conditions</Link>.
        </div>

        {list.length === 0 ? (
          <p className="mt-10 text-center text-text-muted">No bundles are available right now. Check back soon.</p>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {list.map((b) => {
              const tokens = Number(b.tokens);
              const price = Number(b.price_eur);
              const perGame = tokens > 0 ? price / tokens : 0;
              const coinCount = Math.min(MAX_COINS, Math.max(1, Math.round(tokens)));
              return (
                <div key={b.id} className="flex flex-col portal-card p-6 text-center">
                  <h2 className="text-lg font-bold uppercase tracking-[0.08em] text-text">{b.name}</h2>

                  {coinSrc && (
                    <div className="mt-5 flex items-center justify-center" aria-hidden>
                      {Array.from({ length: coinCount }).map((_, i) => (
                        <img
                          key={i}
                          src={coinSrc}
                          alt=""
                          loading="lazy"
                          className="h-20 w-20 object-contain drop-shadow-[0_3px_6px_rgba(0,0,0,0.55)]"
                          style={{ marginLeft: i === 0 ? 0 : "-2.7rem" }}
                        />
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex items-baseline justify-center gap-2">
                    <span className="text-4xl font-bold text-accent">{fmtTokens(tokens)}</span>
                    <span className="text-sm text-text-muted">{tokens === 1 ? "token" : "tokens"}</span>
                  </div>
                  <p className="mt-1 text-sm text-text-muted">
                    {formatEur(price)} · {formatEur(perGame)} per game
                  </p>
                  {b.validity_months ? (
                    <p className="mt-2 text-xs text-text-subtle">Valid for {b.validity_months} months from purchase.</p>
                  ) : null}
                  <div className="mt-auto pt-6">
                    <BuyBundleButton bundleId={b.id} label={`Buy for ${formatEur(price)}`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-10 flex flex-col items-center gap-2 portal-card p-6 text-center">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-accent">Gift game tokens</h2>
          <p className="max-w-md text-sm text-text-muted">
            Treat a friend to a game. Send a single token or a bundle to another player, or to anyone by email.
          </p>
          <div className="mt-2">
            <GiftTokensButton bundles={giftBundles} singleTokenPrice={singleTokenPrice} />
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-text-subtle">
          Payments are processed securely. Tokens are added to your account once payment is confirmed.
        </p>

        <details className="group mt-8 portal-card">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted transition hover:text-accent">
            Terms &amp; Conditions
            <svg
              aria-hidden
              viewBox="0 0 10 6"
              className="h-2.5 w-2.5 shrink-0 transition-transform group-open:rotate-180"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="square"
            >
              <path d="M1 1l4 4 4-4" />
            </svg>
          </summary>
          <div className="space-y-2.5 border-t border-border px-5 py-4 text-xs leading-relaxed text-text-subtle">
            <p>One LaserOps Game Token entitles you to one game entry (a single session), subject to availability and booking a place on a game.</p>
            <p>Tokens are credited to your account once your payment is confirmed. Bundle prices are shown at checkout and are charged in full up front.</p>
            <p>Each bundle&apos;s tokens are valid for the period shown on the bundle (for example, a 5-game bundle is valid for 6 months from the date of purchase). Expired tokens cannot be used or refunded.</p>
            <p>Tokens have no cash value, cannot be exchanged for cash, and are not transferable between accounts.</p>
            <p>If a game is called off partway through (for example, due to weather), a portion of a token may be credited back to your account at our discretion, and can be used toward a future game.</p>
            <p>We may change bundle prices and contents from time to time. Tokens already purchased keep the terms that applied when you bought them. Bundle purchases are otherwise subject to our standard refund policy.</p>
          </div>
        </details>
      </div>
    </Container>
  );
}
