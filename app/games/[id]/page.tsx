/**
 * app/games/[id]/page.tsx
 * --------------------------------------------------------------------
 * Public match invite page (the invite-link destination). Shows the match
 * details to anyone with the link. If the viewer is signed in with an account,
 * they get the sign-up control; otherwise a CTA to sign in / create an account
 * (routing back here). A richer signed-out overlay is a later refinement.
 */
import type { Metadata } from "next";
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
  match_code: string | null;
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

export default async function GameInvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: match } = await supabase
    .from("matches")
    .select(
      "id, match_code, title, status, scheduled_at, min_players, max_players, price_eur, pricing_mode, registered_count, is_double_xp",
    )
    .eq("id", id)
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
  const priceLabel =
    g.price_eur != null
      ? `€${Number(g.price_eur).toFixed(2)}${g.pricing_mode === "flat" ? " total" : " per player"}`
      : null;

  return (
    <Container size="narrow" className="py-12 sm:py-16">
      <div className="border border-border bg-bg-elevated px-6 py-8">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <MatchStatusBadge status={g.status} />
          {g.is_double_xp && (
            <span className="border border-amber-700 bg-amber-950/40 px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.12em] text-amber-300">
              Double XP
            </span>
          )}
        </div>

        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
          {g.title || "LaserOps Game"}
        </h1>
        <p className="mt-2 text-sm text-text-muted">{fmtDateTime(g.scheduled_at)}</p>
        {priceLabel && <p className="mt-1 text-sm text-text-muted">{priceLabel}</p>}

        <div className="mt-5 max-w-xs">
          <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-[0.1em] text-text-subtle">
            <span>
              {reg} / {min} players{g.max_players ? ` (max ${g.max_players})` : ""}
            </span>
            {reg >= min && <span className="text-accent">Quorum met</span>}
          </div>
          <div className="mt-1 h-1.5 w-full bg-bg-overlay">
            <div
              className={`h-full ${reg >= min ? "bg-accent" : "bg-text-muted"}`}
              style={{ width: `${Math.min(100, Math.round((reg / Math.max(1, min)) * 100))}%` }}
            />
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6">
          {user && accountId ? (
            <GameSignupControl
              matchId={g.id}
              accountId={accountId}
              status={g.status}
              isFull={isFull}
              mySignup={mySignup}
            />
          ) : (
            <div>
              <p className="mb-4 text-sm text-text-muted">
                Sign in or create an account to join this game.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button href={`/player-portal/login?next=/games/${g.id}`} variant="primary" size="md">
                  Sign in
                </Button>
                <Button href={`/player-portal/signup?next=/games/${g.id}`} variant="secondary" size="md">
                  Create account
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-text-subtle">
        <Link href="/player-portal/games" className="hover:text-accent">See all upcoming games</Link>
      </p>
    </Container>
  );
}
