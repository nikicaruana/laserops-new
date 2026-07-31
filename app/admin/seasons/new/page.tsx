/**
 * app/admin/seasons/new/page.tsx
 * --------------------------------------------------------------------
 * Create a new season. Season number pre-filled to the next one.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SeasonEditor, type SeasonRecord } from "@/components/admin/SeasonEditor";

export const metadata = { title: "New season" };

export default async function NewSeasonPage() {
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("seasons")
    .select("season_number")
    .order("season_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextNumber = (last?.season_number ?? 0) + 1;

  const blank: SeasonRecord = {
    id: "",
    name: `Season ${nextNumber}`,
    season_number: nextNumber,
    status: "upcoming",
    starts_on: "",
    ends_on: "",
    terms_and_conditions: "",
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 text-xs">
        <Link href="/admin/seasons" className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
          ← Seasons
        </Link>
      </div>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
          New season
        </h1>
      </header>

      <SeasonEditor season={blank} mode="create" />
    </div>
  );
}
