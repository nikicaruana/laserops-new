import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPlayerRivalries } from "@/lib/player-rivalries/engine";
import { RivalriesView } from "@/components/portal/rivalries/RivalriesView";

export const metadata: Metadata = {
  title: "Rivalries",
};

/**
 * Player Rivalries page.
 *
 * URL state: ?ops=<OpsTag>. Shows all-time head-to-head rivalries: Nemesis,
 * Favourite Prey and a kills-for / kills-against table. Data comes from
 * ingestion (per-opponent kill aggregates); until that lands the view shows a
 * graceful empty state. The search bar lives in the player-stats layout.
 */

type SearchParams = Promise<{ ops?: string }>;

export default async function PlayerRivalriesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const ops = (params.ops ?? "").trim();

  if (ops === "") {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <div className="mt-8 portal-card px-6 py-14 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
            Enter an ops tag to view rivalries
          </p>
          <p className="mt-2 text-sm text-text-subtle">
            Start typing in the search field above – suggestions will appear.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const data = await getPlayerRivalries(supabase, ops);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <RivalriesView ops={ops} data={data} />
    </div>
  );
}
