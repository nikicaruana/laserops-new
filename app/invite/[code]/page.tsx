/**
 * app/invite/[code]/page.tsx
 * --------------------------------------------------------------------
 * Public match invite page (the /invite/<code> destination) — styled as a
 * full-bleed action hero to pull people in, echoing the home hero: an action
 * photo, a dark scrim, a bold title, and a strong sign-up CTA. Signed-in
 * players get the sign-up control; signed-out visitors get a sign in / create
 * account CTA routing back here.
 */
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";
import { GameSignupControl } from "@/components/portal/GameSignupControl";
import { MatchStatusBadge } from "@/components/admin/MatchStatusBadge";

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

const ACTION_IMAGES = [
  "action-1.jpg",
  "action-2.jpg",
  "action-3.jpg",
  "action-4.jpg",
  "action-5.jpg",
  "action-6.jpg",
];

function heroImage(code: string): string {
  let h = 0;
  for (let i = 0; i < code.length; i++) h += code.charCodeAt(i);
  return `/images/gallery/${ACTION_IMAGES[h % ACTION_IMAGES.length]}`;
}

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
  const priceLabel =
    g.price_eur != null
      ? `€${Number(g.price_eur).toFixed(2)}${g.pricing_mode === "flat" ? " total" : " per player"}`
      : null;
  const backHref = `/invite/${code}`;

  return (
    <section className="relative isolate flex min-h-[640px] items-end overflow-hidden sm:min-h-[80vh]">
      {/* Action photo backdrop */}
      <Image
        src={heroImage(code)}
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-10 object-cover"
      />
      {/* Scrim for legibility */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,10,10,0.55) 0%, rgba(10,10,10,0.2) 30%, rgba(10,10,10,0.55) 60%, rgba(10,10,10,0.96) 100%)",
        }}
      />
      {/* Accent glow */}
      <div
        aria-hidden
        className="absolute -right-24 -top-24 -z-10 h-96 w-96 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #ffde00 0%, transparent 70%)" }}
      />

      <Container size="wide" className="relative z-10 w-full pb-12 pt-28 sm:pb-16 sm:pt-40">
        <div className="max-w-3xl">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <MatchStatusBadge status={g.status} />
            {g.is_double_xp && (
              <span className="border border-amber-400 bg-amber-400/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-amber-300">
                Double XP
              </span>
            )}
            <span className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-accent">
              You&rsquo;re invited
            </span>
          </div>

          <h1 className="text-balance text-4xl font-extrabold uppercase leading-[1.02] text-white drop-shadow sm:text-6xl">
            {g.title || "LaserOps Game"}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-white/85 sm:text-base">
            <span className="font-semibold">{fmtDateTime(g.scheduled_at)}</span>
            {priceLabel && <span className="text-white/70">{priceLabel}</span>}
          </div>

          {/* Fill progress */}
          <div className="mt-6 max-w-sm">
            <div className="flex items-center justify-between text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/70">
              <span>
                {reg} / {min} players{g.max_players ? ` · max ${g.max_players}` : ""}
              </span>
              {reg >= min && <span className="text-accent">Quorum met</span>}
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden bg-black/50">
              <div
                className={`h-full ${reg >= min ? "bg-accent" : "bg-white/70"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* CTA card */}
          <div className="mt-8 max-w-xl border border-border bg-bg/80 px-5 py-5 backdrop-blur-md">
            {user && accountId ? (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                  Join this game
                </p>
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
                <p className="mb-4 text-sm text-text-muted">
                  Sign in or create an account to lock in your spot.
                </p>
                <div className="flex flex-wrap gap-3">
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

          <p className="mt-5 text-xs text-white/60">
            <Link href="/player-portal/games" className="hover:text-accent">
              See all upcoming games →
            </Link>
          </p>
        </div>
      </Container>
    </section>
  );
}
