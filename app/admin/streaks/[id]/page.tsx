/**
 * app/admin/streaks/[id]/page.tsx
 * --------------------------------------------------------------------
 * Edit one streak definition + its firing rule + delete.
 */
import Link from "next/link";
import { cldImage } from "@/lib/cld";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StreakEditor, type StreakRecord } from "@/components/admin/StreakEditor";
import { StreakRuleBuilder } from "@/components/admin/StreakRuleBuilder";
import type { StreakRuleConfig } from "@/lib/ingestion/streak-engine";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("streak_definitions").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ? `${data.name} · Streaks` : "Edit streak" };
}

export default async function EditStreakPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: streak } = await supabase
    .from("streak_definitions")
    .select("id, name, description, badge_url, xp, points, tier, is_active, streak_key, rule")
    .eq("id", id)
    .maybeSingle();
  if (!streak) notFound();

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 text-xs">
        <Link href="/admin/streaks" className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
          ← Streaks
        </Link>
      </div>
      <header className="mb-8 flex items-center gap-4 border-b border-border pb-6">
        {streak.badge_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cldImage(streak.badge_url, { w: 384 })} alt="" className="h-12 w-12 shrink-0 object-contain" />
        )}
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
          {streak.name}
        </h1>
      </header>

      <StreakEditor streak={streak as StreakRecord} />

      <div className="mt-6">
        <StreakRuleBuilder
          streakId={streak.id}
          initialRule={(streak.rule ?? null) as StreakRuleConfig | null}
          isBuiltin={Boolean(streak.streak_key)}
        />
      </div>

      <div className="mt-6 max-w-2xl">
        <AdminDeleteButton
          table="streak_definitions"
          id={streak.id}
          name={streak.name ?? "this streak"}
          redirectTo="/admin/streaks"
          noun="streak"
        />
      </div>
    </div>
  );
}
