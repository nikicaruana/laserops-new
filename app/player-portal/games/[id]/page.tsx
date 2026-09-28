/**
 * app/player-portal/games/[id]/page.tsx
 * --------------------------------------------------------------------
 * Player-facing single game view. Doubles as the organizer view for a game the
 * player opened: shows the details, the fill progress, the sign-up / waitlist
 * control, and (for the creator) the invite link to share. Auth-gated. Reads the
 * match via public_read RLS; only denormalized counts are shown (a player can't
 * read other players' signups).
 */
import type { Metadata } from "next";
import { cldImage } from "@/lib/cld";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";
import { GameSignupControl } from "@/components/portal/GameSignupControl";
import { GamesLiveRefresh } from "@/components/portal/GamesLiveRefresh";
import { MatchInviteMenu } from "@/components/portal/MatchInviteMenu";
import { CancelSignupButton } from "@/components/portal/CancelSignupButton";
import { avatarOrDefault } from "@/lib/avatar";
import { MatchStatusHelp } from "@/components/portal/MatchStatusHelp";
import { DeleteMatchButton } from "@/components/portal/DeleteMatchButton";
import { MatchStatusBadge } from "@/components/admin/MatchStatusBadge";
import { getUnlockedGuns } from "@/lib/matches/guns";

export const metadata: Metadata = { title: "Game" };

function fmtDateTime(iso: string | null): string {
  if (!iso) return "Date TBC";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date TBC";
  return d.toLocaleString("en-GB", {
    timeZone: "Europe/Malta",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function GameDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { id } = await params;
  const justPaid = (await searchParams).paid === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/player-portal/login?next=/player-portal/games/${id}`);

  const { data: account } = await supabase
    .from("accounts")
    .select("id, ops_tag, is_admin")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!account) redirect("/player-portal/games");

  const { data: match } = await supabase
    .from("matches")
    .select(
      "id, match_code, title, status, scheduled_at, min_players, max_players, price_eur, pricing_mode, registered_count, is_double_xp, is_private, invite_code, created_by",
    )
    .eq("id", id)
    .maybeSingle();
  if (!match) notFound();

  const [{ data: mySignup }, guns, { data: participant }, { data: wlRows }] = await Promise.all([
    supabase
      .from("match_signups")
      .select("payment_intent, status, paid_at, booked_gun")
      .eq("match_id", id)
      .eq("account_id", account.id)
      .maybeSingle(),
    getUnlockedGuns(supabase, account.ops_tag, { includeLocked: account.is_admin === true }),
    supabase.from("match_participants").select("id").eq("match_id", id).eq("account_id", account.id).maybeSingle(),
    supabase.rpc("my_waitlist_positions"),
  ]);

  const isCreator = match.created_by === account.id;
  const amSignedUp = Boolean(mySignup && mySignup.status !== "cancelled");
  // Creator, admin, or anyone signed up can see who's in (ops tags only, definer RPC).
  const canViewSignups = isCreator || amSignedUp;
  const { data: signupRows } = canViewSignups
    ? await supabase.rpc("match_signups_for_organizer", { p_match_id: id })
    : { data: null };
  const signups = (signupRows ?? []) as { ops_tag: string | null; profile_pic_url: string | null; level: number | null; rank_badge_url: string | null; status: string; signed_up_at: string }[];
  const reg = match.registered_count ?? 0;
  const min = match.min_players ?? 10;
  const isFull = match.max_players != null && reg >= match.max_players;
  const pct = Math.min(100, Math.round((reg / Math.max(1, min)) * 100));
  const showPrice = match.price_eur != null && match.pricing_mode === "per_player";
  const isLiveMine = match.status === "live" && mySignup?.status === "registered";
  const joined = Boolean(participant);
  const wlPosition =
    ((wlRows ?? []) as { match_id: string; wl_position: number }[]).find((r) => r.match_id === id)?.wl_position ?? null;

  // Game-token wallet, so the player can pay with tokens. Only meaningful for a
  // priced game they haven't paid yet; the ledger read is server-side + own-rows.
  const needsTokenInfo = showPrice && mySignup?.status === "registered" && !mySignup?.paid_at;
  const [{ data: tokenBalance }, { data: tokenSpends }] = needsTokenInfo
    ? await Promise.all([
        supabase.rpc("my_token_balance"),
        supabase.from("token_transactions").select("delta").eq("match_id", id).eq("account_id", account.id).eq("kind", "spend"),
      ])
    : [{ data: 0 }, { data: [] as { delta: number | string }[] }];
  const tokensApplied = (tokenSpends ?? []).reduce((s, r) => s + -Number(r.delta), 0);

  return (
    <Container size="narrow" className="py-10 sm:py-14">
      <GamesLiveRefresh matchIds={[match.id]} watchSignupsFor={match.id} />
      {justPaid && (
        <div className="mb-6 border border-accent bg-accent/10 px-4 py-3 text-sm text-accent">
          Payment received – thanks! It&apos;ll show as paid here in a moment once it&apos;s confirmed.
        </div>
      )}
      <div className="mb-6 text-xs">
        <Link href="/player-portal/games" className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
          ← Games
        </Link>
      </div>

      <header className="border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold uppercase tracking-tight text-text sm:text-4xl">
            {match.title || match.match_code || "Open Game"}
          </h1>
          <MatchStatusBadge status={match.status} />
          <MatchStatusHelp />
          {match.is_double_xp && (
            <span className="border border-amber-700 bg-amber-950/40 px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.12em] text-amber-300">
              Double XP
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-text-muted">
          {fmtDateTime(match.scheduled_at)}
          {showPrice && <span> · €{Number(match.price_eur).toFixed(2)} per player</span>}
        </p>
        {isCreator ? (
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent">You created this game</p>
        ) : match.created_by === null ? (
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent">Organised by LaserOps</p>
        ) : null}
      </header>

      {/* Payment / signup / join – kept at the top */}
      <section className="mt-6">
        {match.status === "completed" ? (
          <div className="flex flex-col items-start gap-3">
            <span className="inline-flex items-center gap-2 portal-card px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-text-muted">
              This game has finished
            </span>
            {match.match_code && (
              <Link
                href={`/match-report?match=${encodeURIComponent(match.match_code)}`}
                className="inline-flex items-center gap-2 border border-accent bg-accent px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98]"
              >
                View match report <span aria-hidden>→</span>
              </Link>
            )}
          </div>
        ) : match.status === "cancelled" ? (
          <span className="inline-flex items-center gap-2 border border-red-600/50 bg-red-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-red-300">
            This game was cancelled
          </span>
        ) : isLiveMine ? (
          <Link
            href={joined ? `/player-portal/games/${id}/live` : `/player-portal/games/${id}/join`}
            className="inline-flex items-center gap-2 border border-accent bg-accent px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98]"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bg" />
            {joined ? "View live game" : "Join game"}
          </Link>
        ) : (
          <GameSignupControl
            matchId={id}
            accountId={account.id}
            status={match.status}
            isFull={isFull}
            mySignup={mySignup ?? null}
            guns={guns}
            align="start"
            waitlistPosition={wlPosition}
            priceEur={match.pricing_mode === "per_player" ? Number(match.price_eur) : null}
            isPrivate={Boolean(match.is_private)}
            tokenBalance={Number(tokenBalance ?? 0)}
            tokensApplied={tokensApplied}
            hideCancel
          />
        )}
      </section>

      {/* Fill progress */}
      <div className="mt-8 max-w-sm">
        <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-[0.1em] text-text-subtle">
          <span>
            {reg} / {min} players{match.max_players ? ` (max ${match.max_players})` : ""}
          </span>
          {reg >= min && <span className="text-accent">Quorum met</span>}
        </div>
        <div className="mt-1 h-1.5 w-full bg-bg-overlay">
          <div className={`h-full ${reg >= min ? "bg-accent" : "bg-text-muted"}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Invite – only while the game is still filling (not once live/over). Last
          minute joiners come in on-site via the live entry code, not invites. */}
      {canViewSignups && ["tentative", "awaiting_confirm", "confirmed"].includes(match.status ?? "") && (
        <section className="mt-8">
          <MatchInviteMenu matchId={id} inviteCode={match.invite_code} />
        </section>
      )}

      {/* Who's signed up – visible to the creator and anyone signed up */}
      {canViewSignups && signups.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.12em] text-accent">
            Signed up ({signups.filter((s) => s.status === "registered").length})
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {signups.map((s, i) => {
              const name = s.ops_tag || "Player";
              const waitlisted = s.status === "waitlisted";
              const inner = (
                <>
                  <span className="block w-full truncate text-center text-sm font-bold uppercase tracking-[0.06em] text-text">{name}</span>
                  <span className="flex h-20 w-20 shrink-0 overflow-hidden rounded-sm portal-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cldImage(avatarOrDefault(s.profile_pic_url), { w: 384 })} alt={name} className="h-full w-full object-cover" />
                  </span>
                  {waitlisted ? (
                    <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-amber-300">Waitlist</span>
                  ) : s.level != null ? (
                    <span className="flex items-center gap-1.5">
                      {s.rank_badge_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cldImage(s.rank_badge_url, { w: 384 })} alt="" className="h-5 w-5 object-contain" />
                      )}
                      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-text-muted">Lvl. {s.level}</span>
                    </span>
                  ) : null}
                </>
              );
              const cls = `flex flex-col items-center gap-2.5 border px-3 py-4 ${
                waitlisted ? "border-amber-600/40 bg-amber-500/5" : "border-border bg-bg-elevated"
              }`;
              return (
                <li key={i}>
                  {s.ops_tag ? (
                    <Link href={`/player-portal/player-stats/summary?ops=${encodeURIComponent(s.ops_tag)}`} className={`${cls} transition-colors hover:border-accent`}>
                      {inner}
                    </Link>
                  ) : (
                    <div className={cls}>{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Cancel signup / leave waitlist – only before the game is live (you can't
          back out mid-game). */}
      {amSignedUp && (mySignup?.status === "registered" || mySignup?.status === "waitlisted") && ["tentative", "awaiting_confirm", "confirmed"].includes(match.status ?? "") && (
        <section className="mt-12 border-t border-border pt-6">
          <CancelSignupButton matchId={id} waitlisted={mySignup?.status === "waitlisted"} isOrganiser={isCreator} />
        </section>
      )}

      {/* Organizer: delete before it's confirmed */}
      {isCreator && ["tentative", "awaiting_confirm"].includes(match.status ?? "") && (
        <section className="mt-8 border-t border-border pt-6">
          <DeleteMatchButton matchId={id} />
          <p className="mt-2 text-[0.65rem] text-text-subtle">
            You can delete this game until it&apos;s confirmed.
          </p>
        </section>
      )}
    </Container>
  );
}
