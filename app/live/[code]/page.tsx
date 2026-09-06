/**
 * app/live/[code]/page.tsx
 * --------------------------------------------------------------------
 * Public spectator live view for a match (by match code). No login. Same bases +
 * timers as the player view, a GLOBAL kill feed, and no personal streaks. Great
 * for a screen at the venue or sharing a link with spectators.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LiveFeedClient } from "@/components/live/LiveFeedClient";

export const metadata: Metadata = { title: "Live match", robots: { index: false, follow: false } };

export default async function PublicLivePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: match } = await supabase
    .from("matches")
    .select("id, match_code, title")
    .eq("match_code", decodeURIComponent(code))
    .maybeSingle();
  if (!match) notFound();

  return (
    <main className="min-h-screen bg-bg">
      <div className="mx-auto max-w-[480px] px-2 py-4">
        <h1 className="text-center text-lg font-extrabold uppercase tracking-tight text-text">{match.title || match.match_code}</h1>
        <p className="mb-3 text-center text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-text-subtle">Live · spectator view</p>
        <LiveFeedClient matchId={match.id} mode="public" />
      </div>
    </main>
  );
}
