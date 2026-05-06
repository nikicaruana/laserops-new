import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardPageHeader } from "@/components/portal/DashboardPageHeader";
import { fetchGameDataRows } from "@/lib/game-data/lookup";
import { fetchMatchReport, findPlayerInReport } from "@/lib/match-report/engine";
import { MatchOverview } from "@/components/match-report/MatchOverview";
import { PlayerStatsCard } from "@/components/match-report/PlayerStatsCard";

export const metadata: Metadata = {
  title: "Last Match",
};

/**
 * Last Match page.
 *
 * Shows a match-report-style preview of the selected player's most recent
 * game: match overview (teams, round scores) + the player's individual
 * stats card (XP, accolades, per-match metrics).
 *
 * URL state: ?ops=<OpsTag>  (forwarded from SubTabs via forwardParams).
 *
 * The PlayerSearch bar lives in the player-stats layout (PlayerStatsShell)
 * above the sub-tabs row — no search bar needed here.
 */

type SearchParams = Promise<{ ops?: string }>;

export default async function LastMatchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const ops = (params.ops ?? "").trim();

  if (ops === "") {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <DashboardPageHeader title="Last Match" hideAddToHome />
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <DashboardPageHeader title="Last Match" hideAddToHome />
      <Suspense
        key={ops}
        fallback={
          <div className="mt-8 border border-border bg-bg-elevated px-6 py-16 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
              Loading last match…
            </p>
          </div>
        }
      >
        <LastMatchContent ops={ops} />
      </Suspense>
    </div>
  );
}

async function LastMatchContent({ ops }: { ops: string }) {
  const gameDataResult = await fetchGameDataRows();

  if (!gameDataResult.ok) {
    return (
      <div className="mt-8 border border-border bg-bg-elevated px-6 py-14 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
          Could not load match data
        </p>
      </div>
    );
  }

  // Filter to this player's rows (case-insensitive)
  const needle = ops.toLowerCase();
  const playerRows = gameDataResult.rows.filter(
    (r) => r.nickname.toLowerCase() === needle,
  );

  if (playerRows.length === 0) {
    return (
      <div className="mt-8 border border-dashed border-border bg-bg-elevated px-6 py-14 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">
          No Matches Found
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm text-text-muted sm:text-base">
          &ldquo;{ops}&rdquo; hasn&rsquo;t played any recorded matches yet.
        </p>
      </div>
    );
  }

  // Collect unique match IDs with their yearMonth so we can sort
  const matchMap = new Map<string, string>(); // matchId → yearMonth
  for (const row of playerRows) {
    if (row.matchId && !matchMap.has(row.matchId)) {
      matchMap.set(row.matchId, row.yearMonth);
    }
  }

  // Sort: yearMonth desc first, then matchId desc within the same month.
  // Both comparisons are string-safe for the YYYY-MM / LO-YYYY-NN formats.
  const sorted = [...matchMap.entries()].sort(([idA, ymA], [idB, ymB]) => {
    if (ymB !== ymA) return ymB.localeCompare(ymA);
    return idB.localeCompare(idA);
  });

  const lastMatchId = sorted[0]?.[0];
  if (!lastMatchId) {
    return <NoMatchesState ops={ops} />;
  }

  // Fetch the full match report
  const matchResult = await fetchMatchReport(lastMatchId);

  if (!matchResult.ok) {
    return (
      <div className="mt-8 border border-border bg-bg-elevated px-6 py-14 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
          Match report unavailable
        </p>
        <p className="mt-2 text-sm text-text-subtle">
          Could not load data for match {lastMatchId}.
        </p>
      </div>
    );
  }

  const { report } = matchResult;
  const player = findPlayerInReport(report, ops);

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <MatchOverview game={report.game} matchDate={report.matchDate} />
      {player ? (
        <PlayerStatsCard player={player} ranks={report.ranks} />
      ) : (
        <div className="border border-border bg-bg-elevated px-6 py-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
            Player stats not available for this match
          </p>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-8 border border-border bg-bg-elevated px-6 py-12 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
        Search for a player to see their last match
      </p>
      <p className="mt-2 text-sm text-text-subtle">
        Use the search bar above to find a player.
      </p>
    </div>
  );
}

function NoMatchesState({ ops }: { ops: string }) {
  return (
    <div className="mt-8 border border-dashed border-border bg-bg-elevated px-6 py-14 text-center">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">
        No Matches Found
      </p>
      <p className="mx-auto mt-3 max-w-md text-sm text-text-muted sm:text-base">
        &ldquo;{ops}&rdquo; hasn&rsquo;t played any recorded matches yet.
      </p>
    </div>
  );
}
