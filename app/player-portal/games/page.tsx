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
import { getRefundConfig } from "@/lib/payments/refund-config";
import { PlayerBar } from "@/components/portal/PlayerBar";
import { GamesViewToggle } from "@/components/portal/GamesViewToggle";
import { GamesLiveRefresh } from "@/components/portal/GamesLiveRefresh";
import { MatchStatusHelp } from "@/components/portal/MatchStatusHelp";
import { MatchStatusBadge } from "@/components/admin/MatchStatusBadge";
import { getUnlockedGuns } from "@/lib/matches/guns";

export const metadata: Metadata = { title: "Game Portal" };

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
  is_private: boolean | null;
  is_beginner: boolean | null;
  beginner_max_level: number | null;
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

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const beginnerOnly = filter === "beginner";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/player-portal/login?next=/player-portal/games");

  const { data: account } = await supabase
    .from("accounts")
    .select("id, ops_tag, is_admin, discount_price_eur")
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
    "id, match_code, title, status, scheduled_at, min_players, max_players, price_eur, pricing_mode, registered_count, is_double_xp, is_private, is_beginner, beginner_max_level";

  const [{ data: signupRows }, guns, { data: participantRows }, { data: inviteRows }, { data: levelRow }] = await Promise.all([
    supabase
      .from("match_signups")
      .select("match_id, payment_intent, status, paid_at, booked_gun")
      .eq("account_id", account.id),
    getUnlockedGuns(supabase, account.ops_tag, { includeLocked: account.is_admin === true }),
    supabase.from("match_participants").select("match_id").eq("account_id", account.id),
    supabase.rpc("my_pending_match_invites"),
    supabase.from("player_stats_lifetime").select("current_level").eq("account_id", account.id).maybeSingle(),
  ]);
  const viewerLevel = (levelRow as { current_level: number | null } | null)?.current_level ?? 1;
  const refundPolicyText = (await getRefundConfig()).policyText;

  const joinedIds = new Set(((participantRows ?? []) as { match_id: string }[]).map((p) => p.match_id));
  const mine = new Map<string, MySignup>();
  for (const s of (signupRows ?? []) as MySignup[]) mine.set(s.match_id, s);
  const mySignupIds = ((signupRows ?? []) as MySignup[])
    .filter((s) => s.status === "registered" || s.status === "waitlisted")
    .map((s) => s.match_id);

  const invites = (inviteRows ?? []) as { invite_id: string; match_id: string; title: string; invited_by_ops_tag: string | null }[];
  const inviterByMatch = new Map(invites.map((i) => [i.match_id, i.invited_by_ops_tag]));
  const inviteMatchIds = [...new Set(invites.map((i) => i.match_id))];

  const [{ data: openRows }, myRes, { data: createdRows }, { data: wlRows }, invitedRes] = await Promise.all([
    supabase
      .from("matches")
      .select(selectCols)
      .eq("is_private", false)
      .or(`and(status.in.(tentative,awaiting_confirm,confirmed),scheduled_at.gte.${nowIso}),status.eq.live`)
      .order("scheduled_at", { ascending: true }),
    mySignupIds.length
      ? supabase
          .from("matches")
          .select(selectCols)
          .in("id", mySignupIds)
          .in("status", ACTIVE)
          .order("scheduled_at", { ascending: true })
      : Promise.resolve({ data: [] as Game[] }),
    supabase
      .from("matches")
      .select(selectCols)
      .eq("created_by", account.id)
      .in("status", ACTIVE)
      .order("scheduled_at", { ascending: true }),
    supabase.rpc("my_waitlist_positions"),
    inviteMatchIds.length
      ? supabase
          .from("matches")
          .select(selectCols)
          .in("id", inviteMatchIds)
          .in("status", ACTIVE)
          .order("scheduled_at", { ascending: true })
      : Promise.resolve({ data: [] as Game[] }),
  ]);

  const createdGames = (createdRows ?? []) as Game[];
  const createdIdSet = new Set(createdGames.map((g) => g.id));
  // The creator is auto-signed-up to their own game; show it only under "created".
  const myGamesAll = ((myRes.data ?? []) as Game[]).filter((g) => !createdIdSet.has(g.id));
  const myIdSet = new Set(myGamesAll.map((g) => g.id));
  // Invited: games with a pending invite the player hasn't created or joined.
  const invitedAll = ((invitedRes.data ?? []) as Game[]).filter((g) => !createdIdSet.has(g.id) && !myIdSet.has(g.id));
  const invitedIdSet = new Set(invitedAll.map((g) => g.id));

  // "Your Live Games": live games the player is in (created / signed up / joined).
  const involvedIds = new Set<string>([...createdIdSet, ...myIdSet, ...joinedIds]);
  const unionById = new Map<string, Game>();
  for (const g of [...createdGames, ...myGamesAll, ...invitedAll, ...((openRows ?? []) as Game[])]) unionById.set(g.id, g);
  const liveGames = [...unionById.values()].filter((g) => g.status === "live" && involvedIds.has(g.id));
  const liveIdSet = new Set(liveGames.map((g) => g.id));

  // Non-live buckets (live ones are lifted into their own section).
  const createdSection = createdGames.filter((g) => !liveIdSet.has(g.id));
  const signedUpSection = myGamesAll.filter((g) => !liveIdSet.has(g.id));
  const invitedSection = invitedAll.filter((g) => !liveIdSet.has(g.id));

  const excluded = new Set<string>([...createdIdSet, ...myIdSet, ...invitedIdSet, ...liveIdSet]);
  const openGames = ((openRows ?? []) as Game[]).filter((g) => !excluded.has(g.id));
  const openGamesShown = beginnerOnly ? openGames.filter((g) => g.is_beginner) : openGames;
  const wlPos = new Map<string, number>();
  for (const r of (wlRows ?? []) as { match_id: string; wl_position: number }[]) wlPos.set(r.match_id, r.wl_position);

  const card = (g: Game, invitedBy?: string | null) => {
    const reg = g.registered_count ?? 0;
    const min = g.min_players ?? 10;
    const isFull = g.max_players != null && reg >= g.max_players;
    const mySignup = mine.get(g.id) ?? null;
    const isLiveMine = g.status === "live" && mySignup?.status === "registered";
    const joined = joinedIds.has(g.id);
    const showPrice = g.price_eur != null && g.pricing_mode === "per_player";
    const isCreated = createdIdSet.has(g.id);
    const beginnerLock =
      g.is_beginner && g.beginner_max_level != null && !account.is_admin && viewerLevel > g.beginner_max_level
        ? { yourLevel: viewerLevel, maxLevel: g.beginner_max_level }
        : null;
    return (
      <li key={g.id} className="flex flex-col gap-3 portal-card p-4 sm:p-5">
        {/* Title + status */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/player-portal/games/${g.id}`} className="block truncate text-base font-bold text-text transition-colors hover:text-accent sm:text-lg">
              {g.title || g.match_code || "Open Game"}
            </Link>
            <p className="mt-0.5 text-xs text-text-muted sm:text-sm">
              {fmtDateTime(g.scheduled_at)}
              {showPrice && <span> · €{Number(g.price_eur).toFixed(2)}/player</span>}
            </p>
            {invitedBy && <p className="mt-0.5 text-[0.7rem] text-accent">Invited by {invitedBy}</p>}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <MatchStatusBadge status={g.status} />
            {g.is_double_xp && (
              <span className="border border-amber-700 bg-amber-950/40 px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-[0.12em] text-amber-300">2XP</span>
            )}
            {g.is_beginner && (
              <span className="border border-emerald-700 bg-emerald-950/40 px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-[0.12em] text-emerald-300">
                Beginners{g.beginner_max_level != null ? ` · max Lvl ${g.beginner_max_level}` : ""}
              </span>
            )}
          </div>
        </div>

        {/* Players: fill is status-coded, a tick marks the minimum, full = max */}
        <PlayerBar reg={reg} min={min} max={g.max_players} status={g.status} />

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
          {/* Once live, the "View live game" button is the action - no separate manage link. */}
          {g.status !== "live" && (
            <Link
              href={`/player-portal/games/${g.id}`}
              className="shrink-0 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-accent hover:text-accent-soft"
            >
              {isCreated ? "Manage game →" : "View game →"}
            </Link>
          )}
          <div className="w-full min-w-0 sm:w-auto">
            {isLiveMine ? (
              <Link
                href={joined ? `/player-portal/games/${g.id}/live` : `/player-portal/games/${g.id}/join`}
                className="inline-flex items-center gap-2 border border-accent bg-accent px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98]"
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bg" />
                {joined ? "View live game" : "Join game"}
              </Link>
            ) : (
              <GameSignupControl
                matchId={g.id}
                accountId={account.id}
                status={g.status}
                isFull={isFull}
                mySignup={mySignup}
                guns={guns}
                align="start"
                waitlistPosition={wlPos.get(g.id) ?? null}
                priceEur={g.pricing_mode === "per_player" ? (account.discount_price_eur != null ? Number(account.discount_price_eur) : Number(g.price_eur)) : null}
                familyFriends={account.discount_price_eur != null}
                isPrivate={Boolean(g.is_private)}
                isOrganiser={isCreated}
                refundPolicy={refundPolicyText}
                beginnerLock={beginnerLock}
                hideCancel
              />
            )}
          </div>
        </div>
      </li>
    );
  };

  // Watch every match on the page so a flip to LIVE (or any change) reflects
  // instantly, not on the next reload / bell poll.
  const watchIds = Array.from(
    new Set([...liveGames, ...createdSection, ...signedUpSection, ...invitedSection, ...openGames].map((g) => g.id)),
  );

  return (
    <Container size="wide" className="py-10 sm:py-14">
      <GamesLiveRefresh matchIds={watchIds} />
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-extrabold uppercase tracking-tight text-text sm:text-4xl">
              Game Portal
            </h1>
            <MatchStatusHelp />
          </div>
          <p className="mt-2 max-w-2xl text-sm text-text-muted">
            Join an open game, manage the games you&apos;ve created or joined, open a new game, or
            book a private one.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/player-portal/games/private"
            className="flex h-11 items-center gap-2 border border-border-strong px-5 text-xs font-bold uppercase tracking-[0.12em] text-text transition-colors hover:border-accent hover:text-accent"
          >
            Book a private game
          </Link>
          <Link
            href="/player-portal/games/new"
            className="flex h-11 items-center gap-2 border border-accent bg-accent px-5 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98]"
          >
            Create an Open Game
          </Link>
        </div>
      </header>

      {liveGames.length > 0 && (
        <GamesGroup title="Your Live Games" count={liveGames.length} className="mb-6">
          <ul className="space-y-3">{liveGames.map((g) => card(g))}</ul>
        </GamesGroup>
      )}

      {createdSection.length > 0 && (
        <GamesGroup title="Games You Created" count={createdSection.length} className="mb-6">
          <ul className="space-y-3">{createdSection.map((g) => card(g))}</ul>
        </GamesGroup>
      )}

      {signedUpSection.length > 0 && (
        <GamesGroup title="Games You're Signed Up To" count={signedUpSection.length} className="mb-6">
          <ul className="space-y-3">{signedUpSection.map((g) => card(g))}</ul>
        </GamesGroup>
      )}

      {invitedSection.length > 0 && (
        <GamesGroup title="Games You're Invited To" count={invitedSection.length} className="mb-6">
          <ul className="space-y-3">{invitedSection.map((g) => card(g, inviterByMatch.get(g.id) ?? null))}</ul>
        </GamesGroup>
      )}

      <GamesGroup title="Join an Open Game" subtitle="These are games anyone can hop in and join" count={openGamesShown.length}>
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href="/player-portal/games"
            className={`border px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.1em] ${!beginnerOnly ? "border-accent bg-accent/10 text-accent" : "border-border-strong text-text-muted hover:border-accent hover:text-accent"}`}
          >
            All games
          </Link>
          <Link
            href="/player-portal/games?filter=beginner"
            className={`border px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.1em] ${beginnerOnly ? "border-accent bg-accent/10 text-accent" : "border-border-strong text-text-muted hover:border-accent hover:text-accent"}`}
          >
            Beginners only
          </Link>
        </div>
        <GamesViewToggle
          games={openGamesShown
            .filter((g) => ["tentative", "awaiting_confirm", "confirmed"].includes(g.status ?? ""))
            .map((g) => ({
              id: g.id,
              title: g.title || g.match_code || "Open Game",
              scheduledAt: g.scheduled_at,
              status: g.status,
              registered: g.registered_count ?? 0,
              min: g.min_players ?? 10,
              max: g.max_players,
              priceEur: g.price_eur,
              pricingMode: g.pricing_mode,
              isDoubleXP: Boolean(g.is_double_xp),
              isBeginner: Boolean(g.is_beginner),
              beginnerMaxLevel: g.beginner_max_level,
            }))}
        >
          {openGamesShown.length === 0 ? (
            <p className="border border-dashed border-border px-4 py-16 text-center text-sm text-text-muted">
              {beginnerOnly ? "No beginners games right now. Check back soon." : "No open games right now. Check back soon."}
            </p>
          ) : (
            <ul className="space-y-3">{openGamesShown.map((g) => card(g))}</ul>
          )}
        </GamesViewToggle>
      </GamesGroup>
    </Container>
  );
}

/** Collapsible game-list group with the compact accent heading + a count. */
function GamesGroup({
  title,
  subtitle,
  count,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  count: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <details open className={`collapsible-section ${className ?? ""}`}>
      <summary className="mb-3 flex cursor-pointer select-none list-none items-center gap-2 py-1 [&::-webkit-details-marker]:hidden">
        <svg aria-hidden viewBox="0 0 12 12" className="collapsible-chevron h-3 w-3 shrink-0 text-accent transition-transform duration-200" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 2l4 4-4 4" strokeLinecap="square" strokeLinejoin="miter" />
        </svg>
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-accent">{title}</h2>
        <span className="text-xs font-semibold text-text-subtle">({count})</span>
      </summary>
      <div className="pt-1">
        {subtitle && <p className="mb-3 text-xs text-text-muted">{subtitle}</p>}
        {children}
      </div>
    </details>
  );
}
