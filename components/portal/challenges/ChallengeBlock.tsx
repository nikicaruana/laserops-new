import { CollapsibleSection } from "@/components/portal/CollapsibleSection";
import { ChallengeLeaderboardTable } from "./ChallengeLeaderboardTable";
import type { Challenge } from "@/lib/cms/challenges";
import type { ChallengeEntry } from "@/lib/leaderboards/season-challenges";

/**
 * ChallengeBlock
 * --------------------------------------------------------------------
 * One challenge: collapsible section whose summary is the challenge name,
 * and whose body is the yellow info card (criteria, prize, priority)
 * followed by the leaderboard table.
 *
 * Server component — wraps the client-side ChallengeLeaderboardTable.
 *
 * Variant detection: we infer the table variant from the challenge's
 * metric column rather than its source mode, because the metric is what
 * the user actually sees and what determines whether progression columns
 * (rank badge, level) make sense:
 *   - Metric `XP_Total` → "xp" variant (shows rank badge + level)
 *   - Source `match_top` → "match_top" variant (shows Match ID column)
 *   - Otherwise → "default" (just rank, photo, name, metric)
 */

type ChallengeBlockProps = {
  challenge: Challenge;
  entries: ChallengeEntry[];
  /** Whether the section starts expanded. */
  defaultOpen?: boolean;
};

export function ChallengeBlock({ challenge, entries, defaultOpen = true }: ChallengeBlockProps) {
  const variant: "xp" | "match_top" | "default" =
    challenge.metric === "XP_Total"
      ? "xp"
      : challenge.sourceMode === "match_top"
        ? "match_top"
        : "default";

  const metricLabel = deriveMetricLabel(challenge);

  return (
    <CollapsibleSection
      title={
        <div className="flex flex-col gap-0.5">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-text-subtle">
            Challenge {challenge.challengeNumber}
          </span>
          <span className="text-base font-extrabold uppercase tracking-tight text-text sm:text-lg">
            {challenge.name}
          </span>
        </div>
      }
      defaultOpen={defaultOpen}
    >
      {/* Yellow info card */}
      <div className="rounded-sm bg-accent px-4 py-4 text-bg sm:px-6 sm:py-5">
        {challenge.description !== "" && (
          <p className="text-sm leading-snug sm:text-base">
            <span className="font-extrabold">Criteria: </span>
            {challenge.description}
          </p>
        )}
        {challenge.prize !== "" && (
          <p className="mt-2 text-sm leading-snug sm:text-base">
            <span className="font-extrabold">Prize: </span>
            {challenge.prize}
          </p>
        )}
        <p className="mt-2 text-sm leading-snug sm:text-base">
          <span className="font-extrabold">Challenge Priority: </span>
          {challenge.priority}
        </p>
      </div>

      {/* Leaderboard table or empty state */}
      <div className="mt-3">
        {entries.length === 0 ? (
          <EmptyEntries />
        ) : (
          <ChallengeLeaderboardTable
            entries={entries}
            variant={variant}
            metricLabel={metricLabel}
          />
        )}
      </div>
    </CollapsibleSection>
  );
}

/**
 * Derive a human-friendly label for the metric column header.
 * Falls through to a humanised version of the raw column name for
 * unknown metrics.
 */
function deriveMetricLabel(challenge: Challenge): string {
  switch (challenge.metric) {
    case "XP_Total":
      return "Total XP";
    case "Rounds_Won":
      return "Rounds Won";
    case "Matches_Won":
      return "Matches Won";
    case "Total_Points":
      return "Total Points";
    case "PlayerFragsCount":
      return "Kills";
    default:
      return challenge.metric.replace(/_/g, " ");
  }
}

/* ---------- Empty state ---------- */

function EmptyEntries() {
  return (
    <div className="border border-dashed border-border bg-bg-elevated px-6 py-10 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
        No data yet for this challenge
      </p>
      <p className="mt-1 text-xs text-text-subtle">
        Check back once more matches have been played in the season.
      </p>
    </div>
  );
}
