/**
 * app/admin/squads/[id]/page.tsx – admin squad management.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminSquadManager, type AdminMember } from "@/components/admin/AdminSquadManager";

export const metadata = { title: "Manage squad" };

export default async function AdminSquadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: squad } = await supabase.from("squads").select("id, name, description, is_searchable, badge_url").eq("id", id).maybeSingle();
  if (!squad) notFound();

  const { data: memberRows } = await supabase
    .from("squad_members")
    .select("account_id, role, is_primary, account:accounts(ops_tag)")
    .eq("squad_id", id)
    .order("role");
  const members = ((memberRows ?? []) as unknown as { account_id: string; role: string; is_primary: boolean; account: { ops_tag: string | null } | null }[]).map((m) => ({
    account_id: m.account_id,
    ops_tag: m.account?.ops_tag ?? null,
    role: m.role,
    is_primary: m.is_primary,
  })) as AdminMember[];

  return (
    <div>
      <div className="mb-6 text-xs">
        <Link href="/admin/squads" className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">← Squads</Link>
      </div>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">{squad.name}</h1>
      </header>
      <AdminSquadManager
        squadId={squad.id}
        initialName={squad.name}
        initialDescription={squad.description ?? ""}
        initialSearchable={squad.is_searchable}
        initialBadgeUrl={squad.badge_url ?? null}
        members={members}
      />
    </div>
  );
}
