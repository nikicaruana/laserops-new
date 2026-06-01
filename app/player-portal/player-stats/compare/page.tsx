import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchAllPlayerStats } from "@/lib/player-stats/shared";
import { fetchGameDataRows } from "@/lib/game-data/lookup";
import { TableErrorState } from "@/components/portal/tables/TableErrorState";
import { CompareView } from "@/components/portal/player-compare/CompareView";

export const metadata: Metadata = {
  title: "Compare Players",
};

/**
 * Compare Players page.
 *
 * Server fetches:
 *   1. All player rows (Player_Stats_PUBLIC) — for the two columns' stats.
 *   2. All game data rows (Game_Data_Lookup_PUBLIC) — for computing how
 *      many UNIQUE guns each player has used across their career.
 *
 * The unique-guns count can't be derived from the aggregated stats sheet
 * (which only stores the favourite gun, not the count of distinct guns).
 * We compute it here by iterating all match rows and counting distinct
 * LaserOps_Gun_Used values per player. The result is a map of
 * lowercased-nickname → unique-gun-count passed down to the client.
 *
 * Both fetches are cached at the sheet layer (5-min ISR), so running
 * them on every page visit is not a cost concern.
 */
export default async function ComparePlayersPage() {
  const [statsResult, gameDataResult] = await Promise.all([
    fetchAllPlayerStats(),
    fetchGameDataRows(),
  ]);

  if (!statsResult.ok) {
    return <TableErrorState detail={statsResult.error} />;
  }

  // Build unique-guns map from per-match data. Keys are lowercased
  // nicknames so client-side lookup can be case-insensitive.
  const uniqueGunsMap: Record<string, number> = {};
  if (gameDataResult.ok) {
    const gunsPerPlayer: Record<string, Set<string>> = {};
    for (const row of gameDataResult.rows) {
      const nick = row.nickname.toLowerCase();
      const gun = (row.raw.LaserOps_Gun_Used ?? "").trim();
      if (gun !== "") {
        if (!gunsPerPlayer[nick]) gunsPerPlayer[nick] = new Set();
        gunsPerPlayer[nick].add(gun);
      }
    }
    for (const [nick, guns] of Object.entries(gunsPerPlayer)) {
      uniqueGunsMap[nick] = guns.size;
    }
  }

  return (
    /* max-w-[680px] ≈ max-w-5xl shrunk by ~35% — keeps the two columns
       readable without filling the whole viewport on large screens. */
    <div className="mx-auto w-full max-w-[680px]">
      <Suspense fallback={null}>
        <CompareView
          allRows={statsResult.rows}
          uniqueGunsMap={uniqueGunsMap}
        />
      </Suspense>
    </div>
  );
}
