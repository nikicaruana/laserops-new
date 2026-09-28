/**
 * app/admin/killstreaks/[id]/page.tsx
 * --------------------------------------------------------------------
 * Edit one killstreak definition + delete.
 */
import Link from "next/link";
import { cldImage } from "@/lib/cld";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KillstreakEditor, type KillstreakRecord, type StreakOption } from "@/components/admin/KillstreakEditor";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("killstreak_definitions").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ? `${data.name} · Killstreaks` : "Edit killstreak" };
}

export default async function EditKillstreakPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: killstreak }, { data: streaks }] = await Promise.all([
    supabase
      .from("killstreak_definitions")
      .select("id, key, name, description, icon, badge_url, scope, duration_seconds, unlock_streak_key, overlay_text, arm_instructions, sort_order, is_active")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("streak_definitions").select("streak_key, name").not("streak_key", "is", null).order("name"),
  ]);
  if (!killstreak) notFound();
  const streakOptions = (streaks ?? []) as StreakOption[];

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 text-xs">
        <Link href="/admin/killstreaks" className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
          ← Killstreaks
        </Link>
      </div>
      <header className="mb-8 flex items-center gap-4 border-b border-border pb-6">
        {killstreak.badge_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cldImage(killstreak.badge_url, { w: 384 })} alt="" className="h-12 w-12 shrink-0 object-contain" />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center border border-border text-2xl">
            {killstreak.icon || "•"}
          </span>
        )}
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
          {killstreak.name}
        </h1>
      </header>

      <KillstreakEditor killstreak={killstreak as KillstreakRecord} streakOptions={streakOptions} />

      <div className="mt-6 max-w-2xl">
        <AdminDeleteButton
          table="killstreak_definitions"
          id={killstreak.id}
          name={killstreak.name ?? "this killstreak"}
          redirectTo="/admin/killstreaks"
          noun="killstreak"
        />
      </div>
    </div>
  );
}
