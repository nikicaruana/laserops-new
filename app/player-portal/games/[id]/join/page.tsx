/**
 * app/player-portal/games/[id]/join/page.tsx
 * --------------------------------------------------------------------
 * A signed-up player joins a live match. Auth-gated. Shows the join form (code
 * + headband + gun from their unlocked armory). Guards: the game must be live
 * and the player must have a registered signup — otherwise a clear message.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";
import { JoinMatchForm } from "@/components/portal/JoinMatchForm";
import { getUnlockedGuns } from "@/lib/matches/guns";

export const metadata: Metadata = { title: "Join game", robots: { index: false, follow: false } };

export default async function JoinMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/player-portal/login?next=/player-portal/games/${id}/join`);

  const { data: account } = await supabase
    .from("accounts")
    .select("id, ops_tag, is_admin")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!account) {
    return (
      <Container size="narrow" className="py-16">
        <p className="text-center text-text-muted">We couldn&apos;t find an account for your login.</p>
      </Container>
    );
  }

  const { data: match } = await supabase
    .from("matches")
    .select("id, title, status")
    .eq("id", id)
    .maybeSingle();
  if (!match) notFound();

  const [{ data: signup }, guns, { data: participant }] = await Promise.all([
    supabase
      .from("match_signups")
      .select("status, booked_gun")
      .eq("match_id", id)
      .eq("account_id", account.id)
      .maybeSingle(),
    getUnlockedGuns(supabase, account.ops_tag, { includeLocked: account.is_admin === true }),
    supabase
      .from("match_participants")
      .select("headset_label, gun_used")
      .eq("match_id", id)
      .eq("account_id", account.id)
      .maybeSingle(),
  ]);

  const isRegistered = signup?.status === "registered";

  return (
    <Container size="narrow" className="py-12 sm:py-16">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.24em] text-accent">Join game</p>
          <h1 className="mt-2 text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
            {match.title || "LaserOps Game"}
          </h1>
        </div>

        {match.status !== "live" ? (
          <div className="border border-border bg-bg-elevated px-5 py-8 text-center">
            <p className="text-sm text-text-muted">
              This game isn&apos;t live yet. The join code goes live about 30 minutes before the
              start &mdash; check back then.
            </p>
            <Link href="/player-portal/games" className="mt-4 inline-block text-xs font-semibold uppercase tracking-[0.12em] text-accent">
              ← Back to games
            </Link>
          </div>
        ) : !isRegistered ? (
          <div className="border border-border bg-bg-elevated px-5 py-8 text-center">
            <p className="text-sm text-text-muted">
              You&apos;re not signed up for this game, so you can&apos;t join it. If you&apos;re here
              to play, ask a marshal to add you.
            </p>
            <Link href="/player-portal/games" className="mt-4 inline-block text-xs font-semibold uppercase tracking-[0.12em] text-accent">
              ← Back to games
            </Link>
          </div>
        ) : (
          <div className="border border-border bg-bg-elevated px-5 py-6 sm:px-6">
            <JoinMatchForm
              matchId={match.id}
              guns={guns}
              bookedGun={signup?.booked_gun ?? null}
              initial={
                participant
                  ? { headband: participant.headset_label ?? null, gun: participant.gun_used ?? null }
                  : null
              }
            />
          </div>
        )}
      </div>
    </Container>
  );
}
