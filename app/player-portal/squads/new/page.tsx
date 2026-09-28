/**
 * app/player-portal/squads/new/page.tsx
 * --------------------------------------------------------------------
 * Create a squad. Auth-gated; the create_squad RPC enforces the caps.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";
import { CreateSquadForm } from "@/components/portal/CreateSquadForm";

export const metadata: Metadata = { title: "Create a Squad" };

export default async function NewSquadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/player-portal/login?next=/player-portal/squads/new");

  return (
    <Container size="wide" className="py-10 sm:py-14">
      <div className="mb-6 text-xs">
        <Link href="/player-portal/squads" className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
          ← Squads
        </Link>
      </div>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-3xl font-extrabold uppercase tracking-tight text-text sm:text-4xl">Create a Squad</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">You&apos;ll be the captain. Invite players with your squad link.</p>
      </header>
      <CreateSquadForm />
    </Container>
  );
}
