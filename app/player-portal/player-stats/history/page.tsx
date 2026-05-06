import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchPlayerHistory } from "@/lib/player-history/engine";
import { TableErrorState } from "@/components/portal/tables/TableErrorState";
import { PlayerHistoryView } from "@/components/portal/player-history/PlayerHistoryView";
import { HistoryEmptyState } from "@/components/portal/player-history/HistoryEmptyState";

export const metadata: Metadata = {
  title: "History",
};

/**
 * Player History page.
 *
 * URL state: ?ops=<OpsTag>. When present, server fetches that player's
 * match history; otherwise renders an empty state.
 *
 * The PlayerSearch bar lives in the player-stats layout (PlayerStatsShell),
 * so it appears above the sub-tabs for all player-stats pages — no separate
 * search bar here.
 */

type SearchParams = Promise<{ ops?: string }>;

export default async function PlayerHistoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const ops = (params.ops ?? "").trim();

  return (
    <div className="mx-auto w-full max-w-5xl">

      {ops === "" ? (
        <HistoryEmptyState />
      ) : (
        <Suspense
          key={ops}
          fallback={
            <div className="mt-8 border border-border bg-bg-elevated px-6 py-16 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
                Loading history…
              </p>
            </div>
          }
        >
          <HistoryContent ops={ops} />
        </Suspense>
      )}
    </div>
  );
}

async function HistoryContent({ ops }: { ops: string }) {
  const result = await fetchPlayerHistory(ops);

  if (!result.ok) {
    if (result.reason === "player-not-found") {
      return (
        <div className="mt-8 border border-dashed border-border bg-bg-elevated px-6 py-14 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">
            Player Not Found
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm text-text-muted sm:text-base">
            No player named &ldquo;{ops}&rdquo; has match data yet.
            Double-check the Ops Tag — recent players appear in the
            search bar above.
          </p>
        </div>
      );
    }
    return <TableErrorState detail={result.detail} />;
  }

  return <PlayerHistoryView history={result.history} ops={ops} />;
}
