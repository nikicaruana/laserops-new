import { createClient } from "@/lib/supabase/server";
import { fetchAccolades } from "@/lib/cms/accolades";
import { getAccoladeGameRows } from "@/lib/leaderboards/supabase-accolades";
import { getPeriodRowsFromSupabase } from "@/lib/leaderboards/supabase-period";
import { AccoladesLeaderboardTable } from "@/components/portal/tables/AccoladesLeaderboardTable";

/**
 * AccoladesLeaderboard — server-side wrapper.
 *
 * Three parallel fetches:
 *   1. Synthetic per-match accolade rows from Supabase (match_awards),
 *      shaped as GameDataRow with the Accolade_<Name> flag columns — the
 *      source of truth for "who earned what accolade in which match".
 *   2. CMS Accolades (canonical metadata: name, XP) — used to derive each
 *      accolade's tier from its XP value (100=T1, 75=T2, 50=T3).
 *   3. Period rows (Supabase) — used ONLY to derive the year/month filter
 *      options so the accolades dropdown matches the other all-time boards.
 *
 * The synthetic rows already exclude unclaimed "Head NN" scores, so they're
 * neither aggregated nor shipped to the client.
 */
export async function AccoladesLeaderboard() {
  const supabase = await createClient();
  const [gameRows, accolades, periodRows] = await Promise.all([
    getAccoladeGameRows(supabase),
    fetchAccolades(),
    getPeriodRowsFromSupabase(supabase),
  ]);

  return (
    <AccoladesLeaderboardTable
      allRows={gameRows}
      accolades={accolades}
      periodRowsForFilterOptions={periodRows}
    />
  );
}
