/**
 * app/player-portal/squads/[id]/challenge/page.tsx
 * --------------------------------------------------------------------
 * Challenge another squad (id = the squad being challenged). The viewer picks
 * which of the squads they captain/officer is issuing the challenge. Auth-gated.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";
import { ChallengeSquadForm } from "@/components/portal/ChallengeSquadForm";

export const metadata: Metadata = { title: "Challenge Squad" };

export default async function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/player-portal/login?next=/player-portal/squads/${id}/challenge`);
  const { data: account } = await supabase.from("accounts").select("id").eq("auth_user_id", user.id).maybeSingle();

  const { data: away } = await supabase.from("squads").select("id, name").eq("id", id).maybeSingle();
  if (!away) notFound();

  // Squads the viewer manages (captain/officer), excluding the one being challenged.
  const { data: managedRows } = account
    ? await supabase
        .from("squad_members")
        .select("squad_id, squad:squads(id, name)")
        .eq("account_id", account.id)
        .in("role", ["captain", "officer"])
        .neq("squad_id", id)
    : { data: [] };
  const homeOptions = ((managedRows ?? []) as unknown as { squad: { id: string; name: string } | null }[])
    .map((r) => r.squad)
    .filter((s): s is { id: string; name: string } => Boolean(s));
  if (homeOptions.length === 0) redirect(`/player-portal/squads/${id}`);

  return (
    <Container size="wide" className="py-10 sm:py-14">
      <div className="mb-6 text-xs">
        <Link href={`/player-portal/squads/${id}`} className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
          ← {away.name}
        </Link>
      </div>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-3xl font-extrabold uppercase tracking-tight text-text sm:text-4xl">Challenge {away.name}</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">Propose a date, time and team size. Both squads&apos; members sign up.</p>
      </header>
      <ChallengeSquadForm awaySquadId={id} homeOptions={homeOptions} />
    </Container>
  );
}
