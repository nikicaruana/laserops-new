import { CollapsibleSection } from "@/components/portal/CollapsibleSection";
import { ChallengeLeaderboardTable } from "./ChallengeLeaderboardTable";
import type { Challenge } from "@/lib/cms/challenges";
import type { ChallengeEntry } from "@/lib/leaderboards/season-challenges";
import { cn } from "@/lib/cn";

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
      {/* Yellow info card.
          Width follows the same variant-based cap as the table below
          so the two visually align as a single unit. mx-auto centers
          within the parent on wide screens. */}
      <div className={cn("mx-auto w-full", maxWidthForVariant(variant))}>
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

        {/* Leaderboard table or empty state.
            Same width container as the info card above. The variant
            determines the max-width: tables with fewer columns are
            capped narrower so the cells don't end up rattling around
            with vast empty space between rank, name, and metric on
            wide desktops. Mobile is always full-width regardless —
            phone screens don't have the stretching problem. */}
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

/**
 * Per-variant max-width for the challenge block (yellow info card +
 * leaderboard table). Without this, blocks stretch to fill the parent's
 * full width — causing tables with few columns (Round Wins: 4 cols) to
 * have huge empty gutters between the rank, name, and metric on desktop.
 *
 * Tailwind v4 max-w utilities — these are the responsive caps:
 *   - default (4 cols: rank, photo, name, metric) → narrowest
 *   - match_top (5 cols: + match id) → medium
 *   - xp (6 cols: + rank badge + level) → widest
 *
 * All variants are full-width on mobile (sm:max-w-... only). Below sm
 * the entire content uses the parent's width because phones never have
 * enough room to need a cap.
 */
function maxWidthForVariant(variant: "xp" | "match_top" | "default"): string {
  switch (variant) {
    case "xp":
      return "sm:max-w-3xl"; // 48rem — accommodates 6 columns with breathing room
    case "match_top":
      return "sm:max-w-2xl"; // 42rem — 5 columns
    case "default":
      return "sm:max-w-xl"; // 36rem — 4 columns, kept tight
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
