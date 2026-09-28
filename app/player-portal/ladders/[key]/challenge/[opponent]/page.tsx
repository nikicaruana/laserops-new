/**
 * app/player-portal/ladders/[key]/challenge/[opponent]/page.tsx
 * --------------------------------------------------------------------
 * Propose a ladder match against the opponent squad. Auth-gated; the viewer must
 * manage a squad on this ladder within challenge range (RPC re-checks).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";
import { LadderChallengeForm } from "@/components/portal/LadderChallengeForm";

export const metadata: Metadata = { title: "Challenge Squad" };

export default async function ChallengePage({ params }: { params: Promise<{ key: string; opponent: string }> }) {
  const { key, opponent } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/player-portal/login?next=/player-portal/ladders/${key}/challenge/${opponent}`);
  const { data: account } = await supabase.from("accounts").select("id").eq("auth_user_id", user.id).maybeSingle();

  const { data: ladder } = await supabase.from("ladders").select("id").eq("key", key).maybeSingle();
  const { data: opponentSquad } = await supabase.from("squads").select("id, name").eq("id", opponent).maybeSingle();
  if (!ladder || !opponentSquad) notFound();

  // The viewer's squad that's on this ladder (the challenger).
  const { data: managed } = account
    ? await supabase.from("squad_members").select("squad_id").eq("account_id", account.id).in("role", ["captain", "officer"])
    : { data: [] };
  const managedIds = ((managed ?? []) as { squad_id: string }[]).map((m) => m.squad_id);
  let challengerSquadId: string | null = null;
  if (managedIds.length) {
    const { data: onLadder } = await supabase.from("ladder_squads").select("squad_id").eq("ladder_id", ladder.id).in("squad_id", managedIds);
    challengerSquadId = ((onLadder ?? []) as { squad_id: string }[]).map((r) => r.squad_id).find((id) => id !== opponent) ?? null;
  }
  if (!challengerSquadId) redirect(`/player-portal/ladders/${key}`);

  return (
    <Container size="wide" className="py-10 sm:py-14">
      <div className="mb-6 text-xs">
        <Link href={`/player-portal/ladders/${key}`} className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">← Ladder</Link>
      </div>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-3xl font-extrabold uppercase tracking-tight text-text sm:text-4xl">Challenge {opponentSquad.name}</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">Propose a date and time. Their captain accepts or counters until you both settle on it.</p>
      </header>
      <LadderChallengeForm ladderKey={key} challengerSquadId={challengerSquadId} opponentSquadId={opponent} />
    </Container>
  );
}
