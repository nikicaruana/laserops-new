import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getAllPlayerSummaryRows } from "@/lib/player-stats/supabase-summary";
import { CompareView } from "@/components/portal/player-compare/CompareView";

export const metadata: Metadata = {
  title: "Compare Players",
};

/**
 * Compare Players page – now sourced from Supabase (was Google Sheets).
 *
 * Fetches synthetic per-match rows for all players plus a distinct-guns-used
 * map (both from the read-models), then hands them to the existing CompareView
 * unchanged. CompareView does the two-player (?ops / ?compare) lookup and
 * winner highlighting client-side over the full set, exactly as before.
 */
export default async function ComparePlayersPage() {
  const supabase = await createClient();
  const { rows, uniqueGunsMap, accolades } = await getAllPlayerSummaryRows(supabase);

  return (
    /* max-w-[680px] ≈ max-w-5xl shrunk by ~35% – keeps the two columns
       readable without filling the whole viewport on large screens. */
    <div className="mx-auto w-full max-w-[680px]">
      <Suspense fallback={null}>
        <CompareView allRows={rows} uniqueGunsMap={uniqueGunsMap} accolades={accolades} />
      </Suspense>
    </div>
  );
}
