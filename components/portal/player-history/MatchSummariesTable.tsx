"use client";

import { useMemo } from "react";
import {
  LeaderboardTable,
  type LeaderboardColumn,
} from "@/components/portal/tables/LeaderboardTable";
import type { PlayerMatch } from "@/lib/player-history/engine";

/**
 * MatchSummariesTable
 * --------------------------------------------------------------------
 * Sortable table of all matches the player has been in. Mirrors the
 * Looker dashboard's "Match Summaries" table at the bottom of the
 * page.
 *
 * Default sort: Match ID ascending (chronological earliest → latest).
 * The user can re-sort by any column header click.
 *
 * Reuses LeaderboardTable for visual + behavioural consistency with
 * the rest of the player portal — same column-header sort UX, same
 * yellow accent strip on top, etc.
 *
 * --------------------------------------------------------------------
 * BUG FIX in this pass:
 *   The previous version omitted the required `width` and `widthSm`
 *   props on each column. LeaderboardTable's grid layout uses these
 *   to build its grid-template-columns CSS variables (--lb-grid /
 *   --lb-grid-sm); without them every column resolved to nothing and
 *   the table collapsed into a vertical stack of labels and values.
 *
 *   Widths chosen to fit 10 columns into ~600–800px without horizontal
 *   scroll on desktop, and to wrap reasonably on mobile. Match ID +
 *   Gun share the available flex space (they're the only string
 *   columns); numeric columns get fixed pixel widths sized to their
 *   typical content (e.g. "9,840" for damage, "1.55" for rating).
 *
 *   The container will scroll horizontally if total exceeds available
 *   width — that's fine, it's data-dense and 10 columns is a lot.
 * --------------------------------------------------------------------
 *
 * Niki feedback (pass 2): each row links to the match report, scoped
 * to the current player. Reuses LeaderboardTable's existing rowHref
 * prop (same mechanism the all-time leaderboards use to link into
 * player summaries).
 */

type Props = {
  matches: PlayerMatch[];
  /** Player's Ops Tag — passed through to the match report URL so
   *  the linked report opens with this player's stats expanded. */
  ops: string;
};

export function MatchSummariesTable({ matches, ops }: Props) {
  const columns = useMemo<LeaderboardColumn<PlayerMatch>[]>(
    () => [
      {
        key: "matchId",
        header: "Match ID",
        align: "left",
        sortable: true,
        sortType: "string",
        accessor: (row) => row.matchId,
        // Flex column — match IDs are ~12 chars ("LO-2026-10") and need
        // to be readable. Generous min so they never truncate.
        width: "minmax(95px, 1.2fr)",
        widthSm: "minmax(110px, 1.2fr)",
        cell: (row) => (
          <span className="font-mono text-xs sm:text-sm">{row.matchId}</span>
        ),
      },
      {
        key: "gun",
        header: "Gun",
        align: "left",
        sortable: true,
        sortType: "string",
        accessor: (row) => row.gunUsed,
        // Flex column — gun names are the longest string in the table
        // ("AK-25 Predator", "Heavy Mk-II"). Bigger flex than match ID
        // so it gets the lion's share of slack space.
        width: "minmax(90px, 1.6fr)",
        widthSm: "minmax(120px, 1.6fr)",
        cell: (row) => (
          <span className="text-xs sm:text-sm">{row.gunUsed || "—"}</span>
        ),
      },
      {
        key: "score",
        header: "Score",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.score,
        // Score: 4–5 digit numbers with separators ("13,888"). Need
        // ~64px on desktop for the full value + a bit of breathing
        // room for the sort caret.
        width: "56px",
        widthSm: "70px",
        cell: (row) => row.score.toLocaleString("en-US"),
      },
      {
        key: "rating",
        header: "Rating",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.matchRating,
        // 4 chars max ("3.74") + sort caret.
        width: "48px",
        widthSm: "60px",
        cell: (row) => row.matchRating.toFixed(2),
      },
      {
        key: "kills",
        header: "Kills",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.kills,
        // 2-3 digit count.
        width: "40px",
        widthSm: "52px",
        cell: (row) => row.kills.toLocaleString("en-US"),
      },
      {
        key: "kd",
        header: "K/D",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.kd,
        width: "40px",
        widthSm: "50px",
        cell: (row) => row.kd.toFixed(2),
      },
      {
        key: "accuracy",
        header: "Acc%",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.accuracy,
        // 2-digit percent + % sign ("27%").
        width: "44px",
        widthSm: "54px",
        cell: (row) => `${Math.round(row.accuracy * 100)}%`,
      },
      {
        key: "damage",
        header: "Damage",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.damage,
        // 5-digit comma-separated numbers ("15,270") get a wider slot.
        width: "60px",
        widthSm: "76px",
        cell: (row) => row.damage.toLocaleString("en-US"),
      },
      {
        key: "eloChange",
        header: "ELO ±",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.eloChange,
        // Most ELO deltas are 1-2 digits with sign; "—" placeholder
        // for the latest match (no follow-up to compute against).
        width: "44px",
        widthSm: "58px",
        cell: (row) =>
          row.eloChange === 0
            ? "—"
            : (row.eloChange > 0 ? "+" : "") + row.eloChange.toFixed(0),
      },
      {
        key: "xp",
        header: "XP",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.xpEarned,
        // 4-5 digit XP values ("6,500").
        width: "52px",
        widthSm: "66px",
        cell: (row) => row.xpEarned.toLocaleString("en-US"),
      },
    ],
    [],
  );

  return (
    <section
      aria-label="Match Summaries"
      className="overflow-hidden rounded-sm border border-border bg-bg-elevated"
    >
      <header className="bg-accent px-5 py-3 text-center sm:px-6 sm:py-4">
        <h2 className="text-lg font-extrabold uppercase tracking-tight text-bg sm:text-xl">
          Match Summaries
        </h2>
      </header>
      <div className="p-3 sm:p-4">
        <LeaderboardTable
          ariaLabel="Match summaries — every match this player has played"
          columns={columns}
          rows={matches}
          rowKey={(row) => row.matchId}
          rowHref={(row) =>
            row.matchId
              ? `/match-report?match=${encodeURIComponent(
                  row.matchId,
                )}&player=${encodeURIComponent(ops)}`
              : null
          }
          rowLinkAriaLabel={(row) => `View match report for ${row.matchId}`}
        />
      </div>
    </section>
  );
}
