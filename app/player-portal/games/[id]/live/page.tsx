/**
 * app/player-portal/games/[id]/live/page.tsx
 * --------------------------------------------------------------------
 * Player live-game view — where a player who's joined a live match lands.
 * For now it confirms they're in (headband + gun) and is a placeholder for the
 * live feed to come (round-by-round scores from uploaded JSON, eventually a
 * real-time feed). If they haven't joined yet, it points them to the join flow.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";

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
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!account) redirect("/player-portal/games");

  const [{ data: match }, { data: participant }] = await Promise.all([
    supabase.from("matches").select("id, title, status").eq("id", id).maybeSingle(),
    supabase
      .from("match_participants")
      .select("headset_label, gun_used")
      .eq("match_id", id)
      .eq("account_id", account.id)
      .maybeSingle(),
  ]);
  if (!match) notFound();

  return (
    <Container size="narrow" className="py-12 sm:py-16">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          <span className="inline-flex items-center gap-2 border border-accent bg-accent/15 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-accent">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            {match.status === "live" ? "Live now" : match.status}
          </span>
          <h1 className="mt-3 text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
            {match.title || "LaserOps Game"}
          </h1>
        </div>

        {participant ? (
          <div className="border border-border bg-bg-elevated px-5 py-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-accent">You&rsquo;re in</p>
            <p className="mt-2 text-sm text-text-muted">
              Headband <span className="font-mono font-semibold text-text">{participant.headset_label ?? "—"}</span>
              {participant.gun_used && (
                <>
                  {" "}
                  · <span className="font-semibold text-text">{participant.gun_used}</span>
                </>
              )}
            </p>
          </div>
        ) : (
          <div className="border border-border bg-bg-elevated px-5 py-6 text-center">
            <p className="text-sm text-text-muted">You haven&apos;t joined this game yet.</p>
            <Link
              href={`/player-portal/games/${id}/join`}
              className="mt-4 inline-block border border-accent bg-accent px-5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-bg"
            >
              Join game
            </Link>
          </div>
        )}

        <div className="mt-6 border border-dashed border-border px-5 py-10 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-text-muted">Live feed</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-text-subtle">
            Round-by-round scores will appear here as the game is played. A live feed is on the way.
          </p>
        </div>

        <p className="mt-5 text-center text-xs text-text-subtle">
          <Link href="/player-portal/games" className="hover:text-accent">← Back to your games</Link>
        </p>
      </div>
    </Container>
  );
}
