/**
 * app/player-portal/games/[id]/live/page.tsx
 * --------------------------------------------------------------------
 * Player live-game view – where a player who's joined a live match lands. Shows
 * their own headband + gun and the In-Match Scores (Beta) board: a per-round
 * leaderboard with their own stat card + streaks and everyone's performance,
 * populated as the admin uploads each round's JSON (LiveRosterRefresh nudges it
 * live). If they haven't joined yet it points them to the join flow; once the
 * game ends it points them to their full match report.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";
import { LiveRosterRefresh } from "@/components/portal/LiveRosterRefresh";
import { InMatchScoreboard } from "@/components/portal/InMatchScoreboard";
import { getInMatchScoreboard } from "@/lib/inmatch/scoreboard";
import { createServiceClient } from "@/lib/supabase/service";

export const metadata: Metadata = { title: "Live game", robots: { index: false, follow: false } };

export default async function LiveGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/player-portal/login?next=/player-portal/games/${id}/live`);

  const { data: account } = await supabase
    .from("accounts")
    .select("id, ops_tag, is_admin")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!account) redirect("/player-portal/games");

  const [{ data: match }, { data: participant }] = await Promise.all([
    supabase.from("matches").select("id, match_code, title, status, live_feed_enabled").eq("id", id).maybeSingle(),
    supabase.from("match_participants").select("headset_label, gun_used").eq("match_id", id).eq("account_id", account.id).maybeSingle(),
  ]);
  if (!match) notFound();

  const isLive = match.status === "live";
  const isOver = match.status === "completed";

  // In-match round scores (Beta): live only, visible to players in this match
  // + admins. Once the game is completed players lose the live view entirely
  // and are pointed to the full match report.
  const canSeeScores = isLive && (!!participant || account.is_admin === true);
  // In a live-feed game the current round plays out in the live feed above, so
  // the scoreboard covers the completed PAST rounds only (exclude the current).
  let currentRound: number | null = null;
  if (canSeeScores && match.live_feed_enabled) {
    const { data: ls } = await supabase.from("match_live_state").select("round_no").eq("match_id", match.id).maybeSingle();
    currentRound = (ls?.round_no as number | null) ?? null;
  }
  const svc = canSeeScores ? createServiceClient() : null;
  const scoreboard = svc
    ? await getInMatchScoreboard(svc, match.id, { label: match.title || match.match_code || "Game", date: null }, { excludeRoundNo: currentRound })
    : { label: "", date: null, rounds: [] };

  return (
    <Container size="default" className="py-4 sm:py-6">
      {isLive && <LiveRosterRefresh matchId={match.id} />}
      <div className="mx-auto max-w-lg">
        <div className="mb-4 text-center">
          <span className="inline-flex items-center gap-2 border border-accent bg-accent/15 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-accent">
            {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
            {isLive ? "Live now" : isOver ? "Game over" : match.status}
          </span>
          <h1 className="mt-2 text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
            {match.title || "LaserOps Game"}
          </h1>
        </div>

        {/* Live feed opens fullscreen (it gets messy mid-game) — red CTA at the top, not in the header. */}
        {isLive && participant && match.live_feed_enabled && (
          <Link
            href={`/player-portal/games/${id}/feed`}
            className="mb-4 flex items-center justify-center gap-2.5 border border-red-500 bg-red-600 px-5 py-3 text-sm font-extrabold uppercase tracking-[0.14em] text-white transition-colors hover:bg-red-500"
          >
            <svg viewBox="0 0 100 100" className="h-5 w-5" aria-hidden fill="currentColor">
              <path d="M50 4 L61 39 L96 50 L61 61 L50 96 L39 61 L4 50 L39 39 Z" />
            </svg>
            Live Feed
          </Link>
        )}

        {participant ? (
          <div className="portal-card px-5 py-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-accent">You&rsquo;re in</p>
            <p className="mt-2 text-sm text-text-muted">
              Headband <span className="font-mono font-semibold text-text">{participant.headset_label ?? "–"}</span>
              {participant.gun_used && (
                <>
                  {" "}
                  · <span className="font-semibold text-text">{participant.gun_used}</span>
                </>
              )}
            </p>
          </div>
        ) : isLive ? (
          <div className="portal-card px-5 py-6 text-center">
            <p className="text-sm text-text-muted">You haven&apos;t joined this game yet.</p>
            <Link href={`/player-portal/games/${id}/join`} className="mt-4 inline-block border border-accent bg-accent px-5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-bg">
              Join game
            </Link>
          </div>
        ) : null}
      </div>

      {scoreboard.rounds.length > 0 && (
        <div className="mx-auto mt-6 max-w-lg lg:max-w-none">
          <InMatchScoreboard scoreboard={scoreboard} me={account.ops_tag ?? null} pastMode={match.live_feed_enabled === true} />
        </div>
      )}

      <div className="mx-auto max-w-lg">
        {isOver && (
          <div className="mt-6 portal-card px-5 py-6 text-center">
            <p className="text-sm text-text-muted">This game has finished.</p>
            {match.match_code && (
              <Link href={`/match-report?match=${match.match_code}`} className="mt-4 inline-block border border-accent bg-accent px-5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-bg">
                View full match report
              </Link>
            )}
          </div>
        )}

        <p className="mt-5 text-center text-xs text-text-subtle">
          <Link href="/player-portal/games" className="hover:text-accent">← Back to your games</Link>
        </p>
      </div>
    </Container>
  );
}
