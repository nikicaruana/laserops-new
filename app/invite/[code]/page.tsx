/**
 * app/invite/[code]/page.tsx
 * --------------------------------------------------------------------
 * Public match invite page (the /invite/<code> destination) — built on the
 * home hero composition (yellow textured background + figure PNG, desktop and
 * mobile), with a centered semi-opaque black card holding the LaserOps logo,
 * an "You're invited" line, the match title and details, and the sign-up CTA.
 */
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { createClient } from "@/lib/supabase/server";
import { GameSignupControl } from "@/components/portal/GameSignupControl";

export const metadata: Metadata = { title: "Game invite", robots: { index: false, follow: false } };

type Game = {
  id: string;
  title: string | null;
  status: string | null;
  scheduled_at: string | null;
  min_players: number | null;
  max_players: number | null;
  price_eur: number | null;
  pricing_mode: string | null;
  registered_count: number | null;
  is_double_xp: boolean | null;
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return "Date to be confirmed";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date to be confirmed";
  return d.toLocaleString("en-GB", {
    timeZone: "Europe/Malta",
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function GameInvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();

  const { data: match } = await supabase
    .from("matches")
    .select(
      "id, title, status, scheduled_at, min_players, max_players, price_eur, pricing_mode, registered_count, is_double_xp",
    )
    .eq("invite_code", code)
    .maybeSingle();

  if (!match) notFound();
  const g = match as Game;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let accountId: string | null = null;
  let mySignup: { payment_intent: string | null; status: string | null; paid_at: string | null } | null = null;
  if (user) {
    const { data: account } = await supabase
      .from("accounts")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    accountId = account?.id ?? null;
    if (accountId) {
      const { data: s } = await supabase
        .from("match_signups")
        .select("payment_intent, status, paid_at")
        .eq("match_id", g.id)
        .eq("account_id", accountId)
        .maybeSingle();
      mySignup = s ?? null;
    }
  }

  const reg = g.registered_count ?? 0;
  const min = g.min_players ?? 10;
  const isFull = g.max_players != null && reg >= g.max_players;
  const pct = Math.min(100, Math.round((reg / Math.max(1, min)) * 100));
  // Price is only meaningful to a player when it's charged per person.
  const showPrice = g.price_eur != null && g.pricing_mode === "per_player";
  const backHref = `/invite/${code}`;

  return (
    <section className="relative isolate flex min-h-[calc(100svh-72px)] items-center justify-center overflow-hidden">
      {/* ---- Hero backdrop: yellow textured bg + figure (mobile) ---- */}
      <div className="absolute inset-0 -z-20 xl:hidden" aria-hidden>
        <Image src="/images/hero/hero-mobile-bg.png" alt="" fill priority sizes="100vw" className="object-cover" />
      </div>
      <div className="absolute inset-x-0 bottom-0 -z-10 flex justify-center xl:hidden" aria-hidden>
        <Image
          src="/images/hero/hero-mobile-figure-color.png"
          alt=""
          width={1080}
          height={890}
          priority
          sizes="100vw"
          className="h-auto w-[130%] max-w-none"
        />
      </div>

      {/* ---- Hero backdrop: yellow textured bg + figure (desktop) ---- */}
      <div className="absolute inset-0 -z-20 hidden xl:block" aria-hidden>
        <Image src="/images/hero/desktop-hero-01-bg.png" alt="" fill priority sizes="100vw" className="object-cover" />
      </div>
      <div className="absolute inset-y-0 right-0 -z-10 hidden items-end xl:flex" aria-hidden>
        <Image
          src="/images/hero/desktop-hero-01-figure-color.png"
          alt=""
          width={2400}
          height={1350}
          priority
          sizes="100vw"
          className="block h-full w-auto max-w-none"
        />
      </div>

      {/* Soft darken so the centered card reads on any part of the art */}
      <div className="absolute inset-0 -z-10 bg-black/20" aria-hidden />

      {/* ---- Centered invite card ---- */}
      <div className="relative z-10 mx-4 w-full max-w-md border border-white/10 bg-black/75 px-6 py-8 text-center shadow-2xl backdrop-blur-md sm:px-8 sm:py-10">
        <div className="flex justify-center">
          <Logo variant="wordmark" color="white" size="sm" asLink={false} />
        </div>

        <p className="mt-6 text-[0.7rem] font-bold uppercase tracking-[0.28em] text-accent">
          You&rsquo;re invited
        </p>

        <h1 className="mt-2 text-balance text-2xl font-extrabold uppercase leading-[1.05] text-white sm:text-3xl">
          {g.title || "LaserOps Game"}
        </h1>

        <p className="mt-3 text-sm text-white/80">{fmtDateTime(g.scheduled_at)}</p>
        {showPrice && (
          <p className="mt-1 text-sm text-white/60">€{Number(g.price_eur).toFixed(2)} per player</p>
        )}
        {g.is_double_xp && (
          <p className="mt-2 inline-block border border-amber-400/60 bg-amber-400/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-amber-300">
            Double XP
          </p>
        )}

        {/* Players / quorum */}
        <div className="mt-6">
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-2xl font-extrabold text-white">
              {reg}
              <span className="text-white/40">/{min}</span>
            </span>
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/60">
              players signed up
            </span>
          </div>
          <p className="mt-0.5 text-[0.65rem] text-white/45">
            {min} minimum to confirm the game{g.max_players ? ` · ${g.max_players} max` : ""}
          </p>
          <div className="mx-auto mt-2 h-2 w-full max-w-xs overflow-hidden bg-white/15">
            <div
              className={`h-full ${reg >= min ? "bg-accent" : "bg-white/70"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* CTA */}
        <div className="mt-7 border-t border-white/10 pt-6">
          {user && accountId ? (
            <div className="flex flex-col items-center gap-3">
              <GameSignupControl
                matchId={g.id}
                accountId={accountId}
                status={g.status}
                isFull={isFull}
                mySignup={mySignup}
              />
            </div>
          ) : (
            <div>
              <p className="mb-4 text-sm text-white/70">Sign in or create an account to lock in your spot.</p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button href={`/player-portal/login?next=${backHref}`} variant="primary" size="md">
                  Sign in
                </Button>
                <Button href={`/player-portal/signup?next=${backHref}`} variant="secondary" size="md">
                  Create account
                </Button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-5 text-xs text-white/45">
          <Link href="/player-portal/games" className="hover:text-accent">
            See all upcoming games →
          </Link>
        </p>
      </div>
    </section>
  );
}
