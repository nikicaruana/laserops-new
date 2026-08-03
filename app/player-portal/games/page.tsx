/**
 * app/player-portal/games/page.tsx
 * --------------------------------------------------------------------
 * Player games hub. Auth-gated. Two sections:
 *   - Your games  -> every game the player has signed up to (private included),
 *     with a Join button once it's live.
 *   - Open games  -> the public discovery list (unlisted/private games excluded)
 *     to sign up to, minus the ones they're already in.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";
import { GameSignupControl } from "@/components/portal/GameSignupControl";
import { MatchStatusBadge } from "@/components/admin/MatchStatusBadge";
import { getUnlockedGuns } from "@/lib/matches/guns";

export const metadata: Metadata = { title: "Upcoming Games" };

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

type MySignup = {
  match_id: string;
  payment_intent: string | null;
  status: string | null;
  paid_at: string | null;
  booked_gun: string | null;
};

const ACTIVE = ["tentative", "awaiting_confirm", "confirmed", "live"];

function fmtDateTime(iso: string | null): string {
  if (!iso) return "Date TBC";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date TBC";
  return d.toLocaleString("en-GB", {
    timeZone: "Europe/Malta",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function GamesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/player-portal/login?next=/player-portal/games");

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!account) {
    return (
      <Container size="narrow" className="py-16">
        <p className="text-center text-text-muted">
          We couldn&apos;t find an account linked to your login yet. Please contact us and we&apos;ll
          sort it.
        </p>
      </Container>
    );
  }

  const nowIso = new Date().toISOString();
  const selectCols =
    "id, match_code, title, status, scheduled_at, min_players, max_players, price_eur, pricing_mode, registered_count, is_double_xp";

  const [{ data: signupRows }, guns] = await Promise.all([
    supabase
      .from("match_signups")
      .select("match_id, payment_intent, status, paid_at, booked_gun")
      .eq("account_id", account.id),
    getUnlockedGuns(supabase, account.id),
  ]);

  const mine = new Map<string, MySignup>();
  for (const s of (signupRows ?? []) as MySignup[]) mine.set(s.match_id, s);
  const registeredIds = ((signupRows ?? []) as MySignup[])
    .filter((s) => s.status === "registered")
    .map((s) => s.match_id);

  const [{ data: openRows }, myRes] = await Promise.all([
    supabase
      .from("matches")
      .select(selectCols)
      .eq("is_private", false)
      .or(`and(status.in.(tentative,awaiting_confirm,confirmed),scheduled_at.gte.${nowIso}),status.eq.live`)
      .order("scheduled_at", { ascending: true }),
    registeredIds.length
      ? supabase
          .from("matches")
          .select(selectCols)
          .in("id", registeredIds)
          .in("status", ACTIVE)
          .order("scheduled_at", { ascending: true })
      : Promise.resolve({ data: [] as Game[] }),
  ]);

  const myGames = (myRes.data ?? []) as Game[];
  const myIdSet = new Set(myGames.map((g) => g.id));
  const openGames = ((openRows ?? []) as Game[]).filter((g) => !myIdSet.has(g.id));

  const card = (g: Game) => {
    const reg = g.registered_count ?? 0;
    const min = g.min_players ?? 10;
    const isFull = g.max_players != null && reg >= g.max_players;
    const pct = Math.min(100, Math.round((reg / Math.max(1, min)) * 100));
    const mySignup = mine.get(g.id) ?? null;
    const canJoin = g.status === "live" && mySignup?.status === "registered";
    const showPrice = g.price_eur != null && g.pricing_mode === "per_player";
    return (
      <li
        key={g.id}
        className="flex flex-col gap-4 border border-border bg-bg-elevated px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold text-text">{g.title || g.match_code || "Open Game"}</h2>
            <MatchStatusBadge status={g.status} />
            {g.is_double_xp && (
              <span className="border border-amber-700 bg-amber-950/40 px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.12em] text-amber-300">
                Double XP
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {fmtDateTime(g.scheduled_at)}
            {showPrice && <span> · €{Number(g.price_eur).toFixed(2)} per player</span>}
          </p>
          <div className="mt-3 max-w-xs">
            <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-[0.1em] text-text-subtle">
              <span>
                {reg} / {min} players{g.max_players ? ` (max ${g.max_players})` : ""}
              </span>
              {reg >= min && <span className="text-accent">Quorum met</span>}
            </div>
            <div className="mt-1 h-1.5 w-full bg-bg-overlay">
              <div
                className={`h-full ${reg >= min ? "bg-accent" : "bg-text-muted"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="shrink-0">
          {canJoin ? (
            <Link
              href={`/player-portal/games/${g.id}/join`}
              className="inline-flex items-center gap-2 border border-accent bg-accent px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98]"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bg" />
              Join game
            </Link>
          ) : (
            <GameSignupControl
              matchId={g.id}
              accountId={account.id}
              status={g.status}
              isFull={isFull}
              mySignup={mySignup}
              guns={guns}
            />
          )}
        </div>
      </li>
    );
  };

  return (
    <Container size="wide" className="py-10 sm:py-14">
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-3xl font-extrabold uppercase tracking-tight text-text sm:text-4xl">
          Upcoming Games
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          Sign up to an open game. Once enough players join, it&apos;s confirmed and we&apos;ll sort
          out payment. You can pay online or on the day.
        </p>
      </header>

      {myGames.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-accent">Your games</h2>
          <ul className="space-y-3">{myGames.map(card)}</ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-accent">Open games</h2>
        {openGames.length === 0 ? (
          <p className="border border-dashed border-border px-4 py-16 text-center text-sm text-text-muted">
            No open games right now. Check back soon.
          </p>
        ) : (
          <ul className="space-y-3">{openGames.map(card)}</ul>
        )}
      </section>
    </Container>
  );
}
