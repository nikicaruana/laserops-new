/**
 * app/player-portal/games/[id]/live/page.tsx
 * --------------------------------------------------------------------
 * Player live-game view – where a player who's joined a live match lands. Shows
 * their own headband + gun, and a LIVE roster of everyone who's joined that
 * updates in real time as players sign in (LiveRosterRefresh). If they haven't
 * joined yet it points them to the join flow; once the game ends it points them
 * to their match report.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";
import { LiveRosterRefresh } from "@/components/portal/LiveRosterRefresh";
import { LiveFeedClient } from "@/components/live/LiveFeedClient";
import { InMatchScoreboard } from "@/components/portal/InMatchScoreboard";
import { getInMatchScoreboard } from "@/lib/inmatch/scoreboard";
import { createServiceClient } from "@/lib/supabase/service";

export const metadata: Metadata = { title: "Live game", robots: { index: false, follow: false } };

type RosterRow = { headset_label: string | null; name: string | null; gun_used: string | null; is_self: boolean };

export default async function LiveGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/player-portal/login?next=/player-portal/games/${id}/live`);

  const { data: account } = await supabase.from("accounts").select("id, ops_tag, is_admin").eq("auth_user_id", user.id).maybeSingle();
  if (!account) redirect("/player-portal/games");

  const [{ data: match }, { data: participant }, { data: rosterRows }] = await Promise.all([
    supabase.from("matches").select("id, match_code, title, status, live_feed_enabled").eq("id", id).maybeSingle(),
    supabase.from("match_participants").select("headset_label, gun_used").eq("match_id", id).eq("account_id", account.id).maybeSingle(),
    supabase.rpc("live_match_roster", { p_match_id: id }),
  ]);
  if (!match) notFound();

  const roster = (rosterRows ?? []) as RosterRow[];
  const isLive = match.status === "live";
  const isOver = match.status === "completed";

  // In-match round scores (Beta): visible to players in this match + admins.
  const canSeeScores = !!participant || account.is_admin === true;
  const svc = canSeeScores ? createServiceClient() : null;
  const scoreboard = svc
    ? await getInMatchScoreboard(svc, match.id, { label: match.title || match.match_code || "Game", date: null })
    : { label: "", date: null, rounds: [] };

  return (
    <Container size="narrow" className="py-12 sm:py-16">
      {isLive && <LiveRosterRefresh matchId={match.id} />}
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          <span className="inline-flex items-center gap-2 border border-accent bg-accent/15 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-accent">
            {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
            {isLive ? "Live now" : isOver ? "Game over" : match.status}
          </span>
          <h1 className="mt-3 text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
            {match.title || "LaserOps Game"}
          </h1>
        </div>

        {/* Live feed – the player's personalised phone view while the game is on
            (only when the admin has enabled it for this match) */}
        {isLive && participant && match.live_feed_enabled && (
          <div className="mb-6 portal-card p-2">
            <LiveFeedClient matchId={match.id} mode="player" me={account.ops_tag ?? null} />
          </div>
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

        {scoreboard.rounds.length > 0 && (
          <div className="mt-6">
            <InMatchScoreboard scoreboard={scoreboard} me={account.ops_tag ?? null} />
          </div>
        )}

        {/* Live roster */}
        {isLive && (
          <div className="mt-6 portal-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-text-muted">In the arena</p>
              <span className="font-mono text-sm font-bold text-accent">{roster.length}</span>
            </div>
            {roster.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-text-subtle">Waiting for players to sign in…</p>
            ) : (
              <ul className="divide-y divide-border">
                {roster.map((r, i) => (
                  <li key={`${r.headset_label ?? "x"}-${i}`} className={`flex items-center gap-3 px-5 py-3 text-sm ${r.is_self ? "bg-accent/5" : ""}`}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-border-strong bg-bg font-mono text-xs font-bold text-accent">
                      {r.headset_label ?? "–"}
                    </span>
                    <span className="flex-1 truncate font-semibold text-text">
                      {r.name}
                      {r.is_self && <span className="ml-2 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-accent">You</span>}
                    </span>
                    {r.gun_used && <span className="shrink-0 text-xs text-text-subtle">{r.gun_used}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {isOver && (
          <div className="mt-6 portal-card px-5 py-6 text-center">
            <p className="text-sm text-text-muted">This game has finished.</p>
            {match.match_code && (
              <Link href={`/match-report?match=${match.match_code}`} className="mt-4 inline-block border border-accent bg-accent px-5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-bg">
                View match report
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
