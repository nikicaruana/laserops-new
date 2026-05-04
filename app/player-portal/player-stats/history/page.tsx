import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardPageHeader } from "@/components/portal/DashboardPageHeader";
import { fetchPlayerHistory } from "@/lib/player-history/engine";
import { fetchAllPlayerStats, listAllNicknames } from "@/lib/player-stats/shared";
import { PlayerSearch } from "@/components/portal/player-summary/PlayerSearch";
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
 * match history; otherwise renders an empty state with the search bar.
 *
 * Charts + table are client components (recharts requires browser APIs)
 * but the data fetch + computation happens on the server so the page
 * arrives with content already populated — no client-side fetch flicker.
 */

type SearchParams = Promise<{ ops?: string }>;

export default async function PlayerHistoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const ops = (params.ops ?? "").trim();

  // Always fetch the list of known nicknames so the search autocomplete
  // works regardless of whether a player is currently selected. This
  // mirrors the Summary page's pattern.
  const knownPlayersResult = await fetchAllPlayerStats();
  const knownNicknames = knownPlayersResult.ok
    ? listAllNicknames(knownPlayersResult.rows)
    : [];

  return (
    <div className="mx-auto w-full max-w-5xl">
      <DashboardPageHeader title="History" hideAddToHome />

      <Suspense fallback={null}>
        <PlayerSearch knownNicknames={knownNicknames} currentOpsTag={ops} />
      </Suspense>

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

/**
 * Server component that fetches one player's history and renders it.
 * Separated so it can suspend independently of the search bar above.
 */
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
            search dropdown above.
          </p>
        </div>
      );
    }
    return <TableErrorState detail={result.detail} />;
  }

  return <PlayerHistoryView history={result.history} ops={ops} />;
}
