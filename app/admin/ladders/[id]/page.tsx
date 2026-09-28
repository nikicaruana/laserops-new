/**
 * app/admin/ladders/[id]/page.tsx – admin ladder management.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminLadderManager, type LadderSquad, type LadderRequest } from "@/components/admin/AdminLadderManager";

export const metadata = { title: "Manage ladder" };

export default async function AdminLadderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: ladder } = await supabase
    .from("ladders")
    .select("id, key, name, sponsor_name, description, image_url, squad_limit, challenge_range, max_idle_days, start_date, end_date, is_active")
    .eq("id", id)
    .maybeSingle();
  if (!ladder) notFound();

  const [{ data: squadRows }, { data: reqRows }] = await Promise.all([
    supabase.from("ladder_squads").select("squad_id, position, squad:squads(name)").eq("ladder_id", id).order("position"),
    supabase.rpc("ladder_pending_requests", { p_ladder_id: id }),
  ]);
  const squads = ((squadRows ?? []) as unknown as { squad_id: string; position: number; squad: { name: string } | null }[]).map((r) => ({
    squad_id: r.squad_id,
    position: r.position,
    name: r.squad?.name ?? "Squad",
  })) as LadderSquad[];
  const requests = ((reqRows ?? []) as { request_id: string; squad_name: string }[]).map((r) => ({ request_id: r.request_id, squad_name: r.squad_name })) as LadderRequest[];

  return (
    <div>
      <div className="mb-6 text-xs">
        <Link href="/admin/ladders" className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">← Ladders</Link>
      </div>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">{ladder.name}</h1>
        <p className="mt-1 font-mono text-xs text-text-muted">/player-portal/ladders/{ladder.key}</p>
      </header>
      <AdminLadderManager
        ladderId={ladder.id}
        initial={{
          name: ladder.name ?? "",
          sponsor_name: ladder.sponsor_name ?? "",
          description: ladder.description ?? "",
          image_url: ladder.image_url ?? "",
          squad_limit: ladder.squad_limit != null ? String(ladder.squad_limit) : "",
          challenge_range: String(ladder.challenge_range ?? 2),
          max_idle_days: String(ladder.max_idle_days ?? 30),
          start_date: ladder.start_date ?? "",
          end_date: ladder.end_date ?? "",
          is_active: ladder.is_active ?? true,
        }}
        squads={squads}
        requests={requests}
      />
    </div>
  );
}
