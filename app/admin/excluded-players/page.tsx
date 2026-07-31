/**
 * app/admin/excluded-players/page.tsx
 * --------------------------------------------------------------------
 * Manage the prize-ineligible list.
 */
import { createClient } from "@/lib/supabase/server";
import {
  ExcludedPlayersManager,
  type ExcludedItem,
} from "@/components/admin/ExcludedPlayersManager";

export const metadata = { title: "Excluded players" };

export default async function ExcludedPlayersPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("excluded_players")
    .select("id, nickname, reason, status")
    .order("nickname");

  return (
    <div>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
          Excluded players
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Prize-ineligible nicknames (staff, owners, etc.) — kept out of season-challenge + homepage
          leader prizes.
        </p>
      </header>

      <ExcludedPlayersManager initial={(data ?? []) as ExcludedItem[]} />
    </div>
  );
}
