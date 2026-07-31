/**
 * app/admin/seasons/[id]/page.tsx
 * --------------------------------------------------------------------
 * Edit one season + delete + a link to manage its challenges.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SeasonEditor, type SeasonRecord } from "@/components/admin/SeasonEditor";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("seasons").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ? `${data.name} · Seasons` : "Edit season" };
}

export default async function EditSeasonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: season } = await supabase
    .from("seasons")
    .select("id, name, season_number, status, starts_on, ends_on, terms_and_conditions")
    .eq("id", id)
    .maybeSingle();
  if (!season) notFound();

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 text-xs">
        <Link href="/admin/seasons" className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
          ← Seasons
        </Link>
      </div>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
          {season.name}
        </h1>
        {season.season_number != null && (
          <Link
            href={`/admin/challenges?season=${season.season_number}`}
            className="flex h-10 items-center border border-border-strong px-4 text-xs font-bold uppercase tracking-[0.12em] text-text-muted hover:border-accent hover:text-accent"
          >
            Manage challenges
          </Link>
        )}
      </header>

      <SeasonEditor season={season as SeasonRecord} />

      <div className="max-w-2xl">
        <AdminDeleteButton
          table="seasons"
          id={season.id}
          name={season.name ?? "this season"}
          redirectTo="/admin/seasons"
          noun="season"
        />
      </div>
    </div>
  );
}
