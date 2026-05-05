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
 *   - Profile card (photo + nickname + current rank badge + Level N)
 *   - Personal Records (5-tile peak performance row, links to matches)
 *   - 4 charts (ELO progression, score vs avg, kills vs KD, shots vs acc)
 *   - Match Summaries table (sortable, all matches, rows link)
 *
 * --------------------------------------------------------------------
 * CHART WINDOWING (post pass-10)
 *
 * Charts cap at the **last 10 matches** for two reasons:
 *   1. Readability — once a player has played 20+ matches the X axis
 *      becomes a forest of unreadable match IDs, especially on mobile.
 *      The most recent N is also the most diagnostic window for
 *      "how am I trending right now."
 *   2. Performance — recharts re-layouts the entire SVG on every
 *      tooltip hover; very long series start to feel sluggish.
 *
 * The Match Summaries table at the bottom continues to show ALL
 * matches — it's the persistent record. The cap is purely a chart
 * concern.
 *
 * "Last 10" = most recent 10 chronologically. Matches arrive sorted
 * oldest→newest from the engine, so `slice(-10)` gives us the tail.
 * --------------------------------------------------------------------
 *
 * Server component — children are individually marked client where
 * needed (charts use recharts which requires browser APIs, the
 * Personal Records card is now client because each tile links to
 * the match report). Data is passed down as serialised props.
 */

/** Maximum number of matches to render in any chart. See header comment
 *  for rationale. If you ever want to tune this, this is the only
 *  knob — every chart receives the pre-sliced array. */
const CHART_WINDOW_SIZE = 10;

type Props = {
  history: PlayerHistory;
  ops: string;
};

export function PlayerHistoryView({ history, ops }: Props) {
  // Slice once here, pass the same windowed array to all four charts.
  // Cheaper than slicing inside each chart (4× the work) and keeps the
  // window definition co-located with the layout, where the policy
  // ("we want a consistent window across all charts") naturally lives.
  const chartMatches = history.matches.slice(-CHART_WINDOW_SIZE);

  return (
    <div className="mt-8 flex flex-col gap-6 sm:gap-8">
      <HistoryProfileCard
        nickname={ops}
        profilePicUrl={history.profilePicUrl}
        rankBadgeUrl={history.currentRankBadgeUrl}
        rankName={history.currentRankName}
        currentLevel={history.currentLevel}
      />

      <PersonalRecordsCard records={history.records} ops={ops} />

      {/* Charts. Each is a client component because recharts needs
          browser APIs (canvas, ResizeObserver). Match data is passed
          as serialised props — the client doesn't refetch.
          chartMatches is capped at the most recent CHART_WINDOW_SIZE
          matches; the table below still gets the full history. */}
      <EloProgressionChart matches={chartMatches} />
      <ScoreVsAvgChart matches={chartMatches} />
      <KillsVsKdChart matches={chartMatches} />
      <ShotsVsAccuracyChart matches={chartMatches} />

      <MatchSummariesTable matches={history.matches} ops={ops} />
    </div>
  );
}
