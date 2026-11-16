/**
 * app/player-portal/store/gift/page.tsx
 * --------------------------------------------------------------------
 * Gift a game token (or half a game token) to another existing player. Requires
 * sign-in (you gift from your account; the recipient also needs an account). No
 * online payment: the gift is a request the LaserOps team settles by hand (same
 * as a token pack), then the token lands on the recipient and they're notified.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { GiftTokenForm } from "@/components/portal/GiftTokenForm";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Gift a Game Token",
};

export default async function GiftTokenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/player-portal/login?next=/player-portal/store/gift");

  const { data: cfg } = await supabase
    .from("token_config")
    .select("single_token_price_eur")
    .eq("id", 1)
    .maybeSingle();
  const singleTokenPrice = Number(cfg?.single_token_price_eur ?? 35);

  return (
    <Container size="narrow" className="py-12 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/player-portal/store"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-muted transition hover:text-accent"
        >
          <svg aria-hidden viewBox="0 0 12 10" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
            <path d="M5 1L1 5l4 4M1 5h10" />
          </svg>
          Back to store
        </Link>

        <h1 className="mt-5 text-center text-2xl font-bold uppercase tracking-[0.12em] text-text sm:text-3xl">
          Gift a Game Token
        </h1>
        <p className="mt-3 text-center text-sm text-text-muted">
          Send another player a game token (or half a game token) and a message. 1 token = 1 game. We&apos;ll arrange
          payment with you, then the token drops straight into their wallet.
        </p>

        <div className="mt-8 portal-card p-6 sm:p-8">
          <GiftTokenForm singleTokenPrice={singleTokenPrice} />
        </div>
      </div>
    </Container>
  );
}
