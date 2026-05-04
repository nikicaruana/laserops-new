import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/Container";
import { fetchMatchReport, fetchAllMatchIds, findPlayerInReport } from "@/lib/match-report/engine";
import { MatchSearch } from "@/components/match-report/MatchSearch";
import { MatchOverview } from "@/components/match-report/MatchOverview";
import { PlayersTable } from "@/components/match-report/PlayersTable";
import { PlayerStatsCard } from "@/components/match-report/PlayerStatsCard";
import { MatchReportEmptyState } from "@/components/match-report/EmptyState";
import { MatchReportErrorState } from "@/components/match-report/ErrorState";

export const metadata: Metadata = {
  title: "Match Report",
  description:
    "Pull up the full report for any LaserOps Malta match — team scores, player stats, accolades earned.",
};

/**
 * Match Report page.
 *
 * Top-level layout:
 *   1. Yellow search card (Match ID input with autocomplete).
 *   2. Match overview card (rounds, team scores, badges) — when match selected.
 *   3. Players table — when match selected. Each row is clickable and updates
 *      the ?player= URL param.
 *   4. Player stats card — when both match AND player selected. Shows that
 *      player's match-scoped stats, accolades, XP card.
 *
 * URL state model:
 *   /match-report?match=LO-2026-10&player=Glenn
 *
 * Server-side fetches happen synchronously via the engine. Client-side
 * components (search input, player stats card animation) hydrate from
 * the rendered HTML.
 */
type SearchParams = Promise<{ match?: string; player?: string }>;

export default async function MatchReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const matchId = (params.match ?? "").trim();
  const selectedPlayer = (params.player ?? "").trim();

  // Always fetch the list of valid match IDs so the search autocomplete
  // can render. This is cached at the CMS level so repeat visits are cheap.
  const allMatchIds = await fetchAllMatchIds();

  return (
    <main className="bg-bg pb-20">
      <Container className="pt-8 sm:pt-12">
        <h1 className="mb-6 text-center text-2xl font-extrabold uppercase tracking-tight sm:mb-8 sm:text-3xl">
          Match Report
        </h1>

        {/* Search card — always visible, renders at the top regardless of
            whether a match is selected. Yellow background visually
            separates it from the report content below. */}
        <Suspense fallback={null}>
          <MatchSearch
            allMatchIds={allMatchIds}
            initialValue={matchId}
          />
        </Suspense>

        {/* Conditional content based on URL state */}
        {matchId === "" ? (
          <div className="mt-8">
            <MatchReportEmptyState />
          </div>
        ) : (
          // We render the match content via a child server component so
          // its fetch is independent of the autocomplete fetch above.
          // This means rapid match-id changes don't refetch the autocomplete.
          <Suspense fallback={<LoadingState />} key={matchId}>
            <MatchContent matchId={matchId} selectedPlayer={selectedPlayer} />
          </Suspense>
        )}
      </Container>
    </main>
  );
}

/**
 * Server component that fetches and renders one match's content.
 * Separated from the page so it can suspend independently while the
 * search autocomplete stays interactive.
 */
async function MatchContent({
  matchId,
  selectedPlayer,
}: {
  matchId: string;
  selectedPlayer: string;
}) {
  const result = await fetchMatchReport(matchId);

  if (!result.ok) {
    return (
      <div className="mt-8">
        <MatchReportErrorState reason={result.reason} matchId={matchId} />
      </div>
    );
  }

  const { report } = result;
  const player = selectedPlayer ? findPlayerInReport(report, selectedPlayer) : undefined;

  return (
    <div className="mt-8 flex flex-col gap-6 sm:gap-8">
      <MatchOverview game={report.game} matchDate={report.matchDate} />
      <PlayersTable
        players={report.players}
        matchId={matchId}
        selectedPlayer={selectedPlayer}
      />
      {player && (
        <PlayerStatsCard player={player} ranks={report.ranks} />
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mt-8 border border-border bg-bg-elevated px-6 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
        Loading match report…
      </p>
    </div>
  );
}
