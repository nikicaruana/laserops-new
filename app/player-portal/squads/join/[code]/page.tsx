/**
 * app/player-portal/squads/join/[code]/page.tsx
 * --------------------------------------------------------------------
 * Squad invite link target: joins the caller to the squad (join_squad_by_code
 * RPC enforces the caps) and forwards to the squad page. Auth-gated; on error
 * (full, already in 2 squads, bad code) it shows the reason.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Join Squad" };

export default async function JoinSquadPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/player-portal/login?next=/player-portal/squads/join/${code}`);

  const { data: squadId, error } = await supabase.rpc("join_squad_by_code", { p_code: code });

  if (!error && squadId) redirect(`/player-portal/squads/${squadId}`);

  return (
    <Container size="narrow" className="py-16 text-center">
      <h1 className="text-2xl font-bold uppercase tracking-[0.12em] text-text">Couldn&apos;t join</h1>
      <p className="mt-3 text-sm text-text-muted">{error?.message || "That squad invite isn't valid."}</p>
      <Link href="/player-portal/squads" className="mt-6 inline-block text-xs font-bold uppercase tracking-[0.12em] text-accent hover:text-accent-soft">
        ← Back to squads
      </Link>
    </Container>
  );
}
