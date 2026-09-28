import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardPageHeader } from "@/components/portal/DashboardPageHeader";
import { createClient } from "@/lib/supabase/server";
import { findPlayerInReport } from "@/lib/match-report/engine";
import { getPlayerLastMatchId, fetchMatchReportSupabase } from "@/lib/match-report/supabase-engine";
import { MatchOverview } from "@/components/match-report/MatchOverview";
import { PlayersTable } from "@/components/match-report/PlayersTable";
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
 * above the sub-tabs row – no search bar needed here.
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
      <div className="mx-auto w-full max-w-5xl">
        <DashboardPageHeader title="Last Match" hideAddToHome />
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <DashboardPageHeader title="Last Match" hideAddToHome />
      <Suspense
        key={ops}
        fallback={
          <div className="mt-8 portal-card px-6 py-16 text-center">
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
  const supabase = await createClient();
  const lastMatchId = await getPlayerLastMatchId(supabase, ops);

  if (!lastMatchId) {
    return <NoMatchesState ops={ops} />;
  }

  // Fetch the full match report
  const matchResult = await fetchMatchReportSupabase(supabase, lastMatchId);

  if (!matchResult.ok) {
    return (
      <div className="mt-8 portal-card px-6 py-14 text-center">
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
      <PlayersTable
        players={report.players}
        matchId={lastMatchId}
        selectedPlayer={ops}
        linkNamesToProfiles
      />
      {player ? (
        <PlayerStatsCard player={player} ranks={report.ranks} />
      ) : (
        <div className="portal-card px-6 py-10 text-center">
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
    <div className="mt-8 portal-card px-6 py-12 text-center">
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
