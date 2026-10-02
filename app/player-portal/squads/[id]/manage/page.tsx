/**
 * app/player-portal/squads/[id]/manage/page.tsx
 * --------------------------------------------------------------------
 * Squad management: badge (captain), invite link, membership + role controls,
 * edit/disband. Gated to the captain and officers; others are sent to the main
 * squad page. Auth-gated.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";
import { SquadControls, type RosterMember } from "@/components/portal/SquadControls";
import { SquadInviteSearch } from "@/components/portal/SquadInviteSearch";
import { SquadBadgeUploader } from "@/components/portal/SquadBadgeUploader";
import { SquadJoinRequests, type JoinRequest } from "@/components/portal/SquadJoinRequests";

export const metadata: Metadata = { title: "Manage Squad" };

export default async function ManageSquadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/player-portal/login?next=/player-portal/squads/${id}/manage`);
  const { data: account } = await supabase.from("accounts").select("id").eq("auth_user_id", user.id).maybeSingle();

  const { data: squad } = await supabase
    .from("squads")
    .select("id, name, description, badge_url, is_searchable, invite_code")
    .eq("id", id)
    .maybeSingle();
  if (!squad) notFound();

  const { data: rosterRows } = await supabase.rpc("squad_roster", { p_squad_id: id });
  const roster = (rosterRows ?? []) as RosterMember[];
  const me = account ? roster.find((m) => m.account_id === account.id) : undefined;
  // Only captain / officer manage; anyone else goes to the main squad page.
  if (!me || (me.role !== "captain" && me.role !== "officer")) redirect(`/player-portal/squads/${id}`);

  const { data: requestRows } = await supabase.rpc("squad_pending_requests", { p_squad_id: id });
  const requests = (requestRows ?? []) as JoinRequest[];

  return (
    <Container size="wide" className="py-10 sm:py-14">
      <div className="mb-6 text-xs">
        <Link href={`/player-portal/squads/${id}`} className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
          ← {squad.name}
        </Link>
      </div>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-3xl font-extrabold uppercase tracking-tight text-text sm:text-4xl">Manage Squad</h1>
        <p className="mt-2 text-sm text-text-muted">Invite players, manage roles, and edit your squad.</p>
      </header>

      <section className="mb-8">
        <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted">Invite a player</p>
        <SquadInviteSearch squadId={squad.id} squadName={squad.name} />
      </section>

      <SquadJoinRequests requests={requests} />

      {me.role === "captain" && (
        <section className="mb-8">
          <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted">Squad badge</p>
          <SquadBadgeUploader squadId={squad.id} initialUrl={squad.badge_url} name={squad.name} />
        </section>
      )}

      <SquadControls
        squadId={squad.id}
        inviteCode={squad.invite_code}
        myRole={me.role as "captain" | "officer" | "member"}
        myIsPrimary={me.is_primary}
        roster={roster}
        initialName={squad.name}
        initialDescription={squad.description ?? ""}
        initialSearchable={squad.is_searchable}
      />
    </Container>
  );
}
