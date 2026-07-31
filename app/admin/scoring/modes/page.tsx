/**
 * app/admin/scoring/modes/page.tsx
 * --------------------------------------------------------------------
 * Manage the game modes (scenarios) that each have their own score formula.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GameModesManager, type ModeItem } from "@/components/admin/GameModesManager";

export const metadata = { title: "Game modes" };

export default async function GameModesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("game_modes")
    .select("id, name, slug, is_default, sort_order")
    .order("sort_order");

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 text-xs">
        <Link href="/admin/scoring" className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
          ← Scoring formula
        </Link>
      </div>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
          Game modes
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Each mode has its own score formula. One is the default/fallback.
        </p>
      </header>

      <GameModesManager initial={(data ?? []) as ModeItem[]} />
    </div>
  );
}
