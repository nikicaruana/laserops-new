/**
 * app/player-portal/games/[id]/feed/page.tsx
 * --------------------------------------------------------------------
 * Fullscreen live feed — a dedicated, uninterrupted view of the current round's
 * live feed for a player who's joined a live, feed-enabled game (it gets messy
 * mid-game, so it takes over the whole screen: a fixed overlay above the site
 * header, with a back arrow to return to the game's live page). Gated to
 * participants of a live feed-enabled match; anything else redirects to /live.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LiveFeedClient } from "@/components/live/LiveFeedClient";
import { WakeLockToggle } from "@/components/portal/WakeLockToggle";

export const metadata: Metadata = { title: "Live feed", robots: { index: false, follow: false } };

export default async function LiveFeedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/player-portal/login?next=/player-portal/games/${id}/feed`);

  const { data: account } = await supabase.from("accounts").select("id, ops_tag").eq("auth_user_id", user.id).maybeSingle();
  if (!account) redirect("/player-portal/games");

  const [{ data: match }, { data: participant }] = await Promise.all([
    supabase.from("matches").select("id, status, live_feed_enabled").eq("id", id).maybeSingle(),
    supabase.from("match_participants").select("headset_label").eq("match_id", id).eq("account_id", account.id).maybeSingle(),
  ]);
  if (!match) notFound();

  // Only a joined player of a live, feed-enabled game gets the fullscreen feed.
  if (match.status !== "live" || match.live_feed_enabled !== true || !participant) {
    redirect(`/player-portal/games/${id}/live`);
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-bg">
      <div className="flex items-center gap-3 border-b border-border bg-bg-elevated px-3 py-2">
        <Link
          href={`/player-portal/games/${id}/live`}
          aria-label="Back to game"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-border-strong text-text transition-colors hover:border-accent hover:text-accent"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-text-muted">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
          Live Feed
        </span>
        <div className="ml-auto">
          <WakeLockToggle />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <LiveFeedClient matchId={match.id} mode="player" me={account.ops_tag ?? null} />
      </div>
    </div>
  );
}
