import { CollapsibleSection } from "@/components/portal/CollapsibleSection";
import type { Challenge } from "@/lib/cms/challenges";
import type { ChallengeEntry } from "@/lib/leaderboards/season-challenges";
import { cn } from "@/lib/cn";

/**
 * ChallengeBlock
 * --------------------------------------------------------------------
 * Renders one challenge: collapsible section whose summary is the
 * challenge name, and whose body is a yellow "info card" (criteria,
 * prize, priority) followed by a leaderboard table.
 *
 * The table column shape depends on the challenge's source mode:
 *   - period_summed / period_max with metric XP_Total: rank, profile pic,
 *     Ops Tag, badge, level, metric value.
 *   - period_summed / period_max with metric Rounds_Won (or similar):
 *     rank, profile pic, Ops Tag, metric value.
 *   - match_top: rank, profile pic, Ops Tag, Match ID, metric value.
 *
 * Rather than hardcoding the variants, we pick columns dynamically based
 * on what data the entry actually contains:
 *   - Show "Match ID" column iff entry.matchId is defined (match_top)
 *   - Show "Rank Badge" + "Level" columns iff the metric is XP_Total
 *     (proxy for "this challenge cares about progression context")
 *
 * If you find yourself wanting more variants in the future, generalise
 * by adding a Display_Columns column to the CMS Challenges tab.
 */

type ChallengeBlockProps = {
  challenge: Challenge;
  entries: ChallengeEntry[];
  /** Whether the section starts expanded. */
  defaultOpen?: boolean;
};

export function ChallengeBlock({ challenge, entries, defaultOpen = true }: ChallengeBlockProps) {
  // Decide column shape from challenge config.
  const showMatchIdColumn = entries.some((e) => e.matchId !== undefined);
  const showProgressionColumns = challenge.metric === "XP_Total";
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
      {/* Yellow info card. Mirrors the Looker design treatment. */}
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

      {/* Leaderboard table. No data → empty state. */}
      <div className="mt-3">
        {entries.length === 0 ? (
          <EmptyEntries />
        ) : (
          <ChallengeTable
            entries={entries}
            showMatchIdColumn={showMatchIdColumn}
            showProgressionColumns={showProgressionColumns}
            metricLabel={metricLabel}
          />
        )}
      </div>
    </CollapsibleSection>
  );
}

/* ---------- Table ---------- */

type ChallengeTableProps = {
  entries: ChallengeEntry[];
  showMatchIdColumn: boolean;
  showProgressionColumns: boolean;
  metricLabel: string;
};

function ChallengeTable({
  entries,
  showMatchIdColumn,
  showProgressionColumns,
  metricLabel,
}: ChallengeTableProps) {
  return (
    <div
      role="table"
      aria-label="Challenge leaderboard"
      className="overflow-x-auto border border-border bg-bg-elevated [scrollbar-width:thin]"
    >
      {/* Header */}
      <div
        role="row"
        className={cn(
          "grid items-center gap-2 border-b border-border-strong bg-bg-overlay px-3 py-2.5 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-text-muted sm:gap-4 sm:px-5 sm:py-3 sm:text-xs",
          gridTemplateForColumns({ showMatchIdColumn, showProgressionColumns }),
        )}
      >
        <div role="columnheader" className="text-text-subtle">#</div>
        <div role="columnheader">{/* profile pic — no header label */}</div>
        <div role="columnheader">Ops Tag</div>
        {showProgressionColumns && (
          <>
            <div role="columnheader" className="text-center">Rank</div>
            <div role="columnheader" className="text-center">Lvl</div>
          </>
        )}
        {showMatchIdColumn && (
          <div role="columnheader">Match ID</div>
        )}
        <div role="columnheader" className="text-right">{metricLabel}</div>
      </div>

      {/* Rows */}
      <div role="rowgroup">
        {entries.map((entry, idx) => (
          <div
            key={`${entry.rank}-${entry.nickname}-${entry.matchId ?? ""}`}
            role="row"
            className={cn(
              "grid items-center gap-2 border-b border-border/60 px-3 py-2.5 sm:gap-4 sm:px-5 sm:py-3 last:border-b-0",
              gridTemplateForColumns({ showMatchIdColumn, showProgressionColumns }),
              entry.isPrizeWinning && "bg-accent/[0.04]",
            )}
          >
            {/* Rank with prize-winner highlight bar */}
            <div role="cell" className="relative">
              {entry.isPrizeWinning && idx === 0 && (
                <span aria-hidden className="absolute -left-3 top-1/2 h-6 w-[3px] -translate-y-1/2 bg-accent sm:-left-5" />
              )}
              <span className={cn("font-mono text-xs font-bold tabular-nums sm:text-sm", entry.isPrizeWinning ? "text-accent" : "text-text-subtle")}>
                #{String(entry.rank).padStart(2, "0")}
              </span>
            </div>

            {/* Profile pic */}
            <div role="cell">
              <img
                src={entry.profilePicUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="block aspect-square w-10 object-cover sm:w-12"
              />
            </div>

            {/* Ops Tag */}
            <div role="cell" className="min-w-0">
              <span className="block truncate text-sm font-bold text-text sm:text-base [overflow-wrap:anywhere]">
                {entry.nickname}
              </span>
            </div>

            {/* Rank badge + level (XP challenge only) */}
            {showProgressionColumns && (
              <>
                <div role="cell" className="flex items-center justify-center">
                  {entry.rankBadgeUrl !== "" ? (
                    <img
                      src={entry.rankBadgeUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="block h-9 w-auto sm:h-11"
                    />
                  ) : (
                    <span className="text-text-subtle">—</span>
                  )}
                </div>
                <div role="cell" className="text-center">
                  <span className="font-mono text-sm font-bold tabular-nums text-text sm:text-base">
                    {entry.level > 0 ? entry.level : "—"}
                  </span>
                </div>
              </>
            )}

            {/* Match ID (match_top challenges only) */}
            {showMatchIdColumn && (
              <div role="cell">
                <span className="font-mono text-xs tabular-nums text-text-muted sm:text-sm">
                  {entry.matchId ?? "—"}
                </span>
              </div>
            )}

            {/* Metric value */}
            <div role="cell" className="text-right">
              <span className="font-mono text-sm font-bold tabular-nums text-text sm:text-base">
                {entry.metricValue.toLocaleString("en-US")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Build the grid-template-columns string for the table layout.
 * Width strategy:
 *   - rank: small fixed
 *   - profile pic: small fixed
 *   - Ops Tag: takes whatever's left (1fr with minmax(0, 1fr) for safety)
 *   - rank badge: small fixed (when shown)
 *   - level: very small fixed (when shown)
 *   - match ID: medium (when shown) — match IDs like "LO-2026-06" need ~12ch
 *   - metric value: small fixed, right-aligned
 *
 * minmax(0, ...) on the flexible column prevents wide content from
 * blowing out the grid (long Ops Tags, wide metric numbers, etc.) —
 * the column shrinks instead of forcing the row wider than the table.
 */
function gridTemplateForColumns({
  showMatchIdColumn,
  showProgressionColumns,
}: {
  showMatchIdColumn: boolean;
  showProgressionColumns: boolean;
}): string {
  // Each segment becomes a class. Tailwind v4 supports arbitrary
  // grid-template-columns via [grid-template-columns:...]. We compose
  // the value at runtime since there are 4 possible variants.
  const parts: string[] = [];
  parts.push("3rem"); // rank
  parts.push("3rem"); // profile pic (mobile)
  parts.push("minmax(0,1fr)"); // ops tag
  if (showProgressionColumns) {
    parts.push("3rem"); // rank badge
    parts.push("2rem"); // level
  }
  if (showMatchIdColumn) {
    parts.push("minmax(5rem,7rem)"); // match id
  }
  parts.push("minmax(4rem,6rem)"); // metric value
  return `[grid-template-columns:${parts.join("_")}]`;
}

/**
 * Derive a column header label for the metric column from the challenge.
 * Special-cases the metrics we know about; falls back to the raw column
 * name for unknown metrics (better than showing nothing).
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
