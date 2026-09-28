/**
 * app/admin/killstreaks/new/page.tsx
 * --------------------------------------------------------------------
 * Create a new killstreak definition.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KillstreakEditor, type KillstreakRecord, type StreakOption } from "@/components/admin/KillstreakEditor";

export const metadata = { title: "New killstreak" };

export default async function NewKillstreakPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("streak_definitions")
    .select("streak_key, name")
    .not("streak_key", "is", null)
    .order("name");
  const streakOptions = (data ?? []) as StreakOption[];

  const blank: KillstreakRecord = {
    id: "",
    key: "",
    name: "",
    description: "",
    icon: "",
    badge_url: "",
    scope: "one",
    duration_seconds: 30,
    unlock_streak_key: null,
    overlay_text: "",
    arm_instructions: "",
    sort_order: 0,
    is_active: true,
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 text-xs">
        <Link href="/admin/killstreaks" className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
          ← Killstreaks
        </Link>
      </div>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
          New killstreak
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Define what it does, how long it jams the enemy feed, and which streak unlocks a charge.
        </p>
      </header>

      <KillstreakEditor killstreak={blank} streakOptions={streakOptions} mode="create" />
    </div>
  );
}
