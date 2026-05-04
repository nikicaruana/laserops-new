import type { PlayerHistory } from "@/lib/player-history/engine";
import { PersonalRecordsCard } from "./PersonalRecordsCard";
import { EloProgressionChart } from "./EloProgressionChart";
import { ScoreVsAvgChart } from "./ScoreVsAvgChart";
import { KillsVsKdChart } from "./KillsVsKdChart";
import { ShotsVsAccuracyChart } from "./ShotsVsAccuracyChart";
import { MatchSummariesTable } from "./MatchSummariesTable";
import { HistoryProfileCard } from "./HistoryProfileCard";

/**
 * PlayerHistoryView
 * --------------------------------------------------------------------
 * Top-level layout for the History page once a player is selected.
 * Composes:
 *   - Profile card (photo + nickname + current rank badge)
 *   - Personal Records (5-tile peak performance row)
 *   - 4 charts (ELO progression, score vs avg, kills vs KD, shots vs acc)
 *   - Match Summaries table (sortable, all matches)
 *
 * Server component — children are individually marked client where
 * needed (charts use recharts which requires browser APIs). Data is
 * passed down as serialised props.
 */

type Props = {
  history: PlayerHistory;
  ops: string;
};

export function PlayerHistoryView({ history, ops }: Props) {
  // Common case: a player with at least one match. Charts can render
  // even with one match (single data point), though they're more
  // meaningful with several. We always render every section — a chart
  // with one data point is still informative and the layout stays
  // predictable.
  return (
    <div className="mt-8 flex flex-col gap-6 sm:gap-8">
      <HistoryProfileCard
        nickname={ops}
        profilePicUrl={history.profilePicUrl}
        rankBadgeUrl={history.currentRankBadgeUrl}
        rankName={history.currentRankName}
      />

      <PersonalRecordsCard records={history.records} />

      {/* Charts. Each is a client component because recharts needs
          browser APIs (canvas, ResizeObserver). Match data is passed
          as serialised props — the client doesn't refetch. */}
      <EloProgressionChart matches={history.matches} />
      <ScoreVsAvgChart matches={history.matches} />
      <KillsVsKdChart matches={history.matches} />
      <ShotsVsAccuracyChart matches={history.matches} />

      <MatchSummariesTable matches={history.matches} />
    </div>
  );
}
