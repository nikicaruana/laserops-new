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
 */

type Props = {
  matches: PlayerMatch[];
};

export function MatchSummariesTable({ matches }: Props) {
  const columns = useMemo<LeaderboardColumn<PlayerMatch>[]>(
    () => [
      {
        key: "matchId",
        header: "Match ID",
        align: "left",
        sortable: true,
        sortType: "string",
        accessor: (row) => row.matchId,
        width: "minmax(80px, 1fr)",
        widthSm: "minmax(110px, 1fr)",
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
        width: "minmax(70px, 1.4fr)",
        widthSm: "minmax(110px, 1.4fr)",
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
        width: "56px",
        widthSm: "72px",
        cell: (row) => row.score.toLocaleString("en-US"),
      },
      {
        key: "rating",
        header: "Rating",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.matchRating,
        width: "52px",
        widthSm: "62px",
        cell: (row) => row.matchRating.toFixed(2),
      },
      {
        key: "kills",
        header: "Kills",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.kills,
        width: "44px",
        widthSm: "56px",
        cell: (row) => row.kills,
      },
      {
        key: "kd",
        header: "K/D",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.kd,
        width: "44px",
        widthSm: "52px",
        cell: (row) => row.kd.toFixed(2),
      },
      {
        key: "acc",
        header: "Acc %",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.accuracy,
        width: "48px",
        widthSm: "56px",
        cell: (row) => `${Math.round(row.accuracy * 100)}%`,
      },
      {
        key: "damage",
        header: "Damage",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.damage,
        width: "60px",
        widthSm: "76px",
        cell: (row) => row.damage.toLocaleString("en-US"),
      },
      {
        key: "elo",
        header: "ELO +/-",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.eloChange,
        width: "52px",
        widthSm: "64px",
        cell: (row) => formatEloChange(row.eloChange),
      },
      {
        key: "xp",
        header: "XP",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.xpEarned,
        width: "60px",
        widthSm: "76px",
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
      <LeaderboardTable
        ariaLabel="Match summaries for this player"
        columns={columns}
        rows={matches}
        rowKey={(row) => row.matchId}
      />
    </section>
  );
}

/**
 * Format ELO delta with a leading sign and dash for zero. The most
 * recent match often has zero ELO change because there's no follow-up
 * match yet to compute the delta against — render as "—" so it's
 * visually distinct from a real "0 change" result.
 */
function formatEloChange(value: number): string {
  if (value === 0) return "—";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${Math.round(value)}`;
}
