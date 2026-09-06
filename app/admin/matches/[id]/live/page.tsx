/**
 * app/admin/matches/[id]/live/page.tsx
 * --------------------------------------------------------------------
 * Admin live view for a match — the global spectator feed (bases/timers + global
 * kill feed + leaderboard) for a venue screen. Admin-gated by the /admin layout.
 * No public/anonymous link; players get their own personalised view under
 * /player-portal/games/[id]/live.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LiveFeedClient } from "@/components/live/LiveFeedClient";

export const metadata = { title: "Live view" };

export default async function AdminLivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: match } = await supabase.from("matches").select("id, match_code, title, status").eq("id", id).maybeSingle();
  if (!match) notFound();

  return (
    <div>
      <div className="mb-4 flex items-center gap-3 text-xs">
        <Link href={`/admin/matches/${id}`} className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">← Match</Link>
      </div>
      <h1 className="text-center text-lg font-extrabold uppercase tracking-tight text-text">{match.title || match.match_code}</h1>
      <p className="mb-3 text-center text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-text-subtle">Live · global feed</p>
      <LiveFeedClient matchId={match.id} mode="public" />
    </div>
  );
}
