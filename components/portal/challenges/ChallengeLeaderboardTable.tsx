"use client";

import { useMemo } from "react";
import {
  LeaderboardTable,
  type LeaderboardColumn,
} from "@/components/portal/tables/LeaderboardTable";
import { ProfilePicCell } from "@/components/portal/tables/ProfilePicCell";
import { RankBadgeCell } from "@/components/portal/tables/RankBadgeCell";
import type { ChallengeEntry } from "@/lib/leaderboards/season-challenges";
import { cn } from "@/lib/cn";

/**
 * ChallengeLeaderboardTable
 * --------------------------------------------------------------------
 * Client-component wrapper that builds the column definitions for a
 * challenge's leaderboard and renders LeaderboardTable.
 *
 * Why a separate component (not just a function inside ChallengeBlock):
 *   - LeaderboardTable is a client component
 *   - Column definitions include accessor/cell functions which can't be
 *     serialized across the server-component boundary
 *   - This component owns the column array and runs entirely on the client
 *
 * Column shape adapts to the challenge variant:
 *   - showProgressionColumns (XP challenge): rank | photo | Ops Tag |
 *     rank badge | level | metric
 *   - showMatchIdColumn (match-top challenge): rank | photo | Ops Tag |
 *     match id | metric
 *   - default (Round Wins etc.): rank | photo | Ops Tag | metric
 */

type Variant = "xp" | "match_top" | "default";

type Props = {
  entries: ChallengeEntry[];
  variant: Variant;
  metricLabel: string;
  /**
   * Column header for the metric. Some metrics deserve a more
   * descriptive label than the short "metric" word. Defaults to
   * metricLabel if not supplied.
   */
  metricHeader?: string;
};

export function ChallengeLeaderboardTable({
  entries,
  variant,
  metricLabel,
  metricHeader,
}: Props) {
  const headerLabel = metricHeader ?? metricLabel;

  const columns = useMemo<LeaderboardColumn<ChallengeEntry>[]>(() => {
    const cols: LeaderboardColumn<ChallengeEntry>[] = [
      {
        key: "rank",
        header: "#",
        align: "center",
        sortable: false,
        numeric: true,
        width: "22px",
        widthSm: "40px",
        cell: (row) => <RankNumber rank={row.rank} />,
      },
      {
        key: "profile",
        header: "",
        align: "center",
        sortable: false,
        width: "36px",
        widthSm: "60px",
        cell: (row) => (
          <ProfilePicCell url={row.profilePicUrl} nickname={row.nickname} />
        ),
      },
      {
        key: "nickname",
        header: "Ops Tag",
        align: "center",
        sortable: true,
        sortType: "string",
        accessor: (row) => row.nickname,
        // minmax(0, 1fr) — see XPLevels table for why this matters.
        // Bare 1fr would force long unbreakable nicknames to push the
        // grid out of alignment.
        width: "minmax(0, 1fr)",
        widthSm: "minmax(0, 1fr)",
        cell: (row) => (
          <span className="block text-center text-xs font-semibold leading-tight text-text [overflow-wrap:anywhere] sm:text-base">
            {row.nickname}
          </span>
        ),
      },
    ];

    if (variant === "xp") {
      cols.push({
        key: "rankBadge",
        header: "Rank",
        align: "center",
        sortable: true,
        accessor: (row) => row.level,
        width: "36px",
        widthSm: "80px",
        cell: (row) => (
          <RankBadgeCell
            badgeUrl={row.rankBadgeUrl}
            ariaLabel={`Rank badge for ${row.nickname}`}
          />
        ),
      });
      cols.push({
        key: "level",
        header: "Lvl",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.level,
        width: "22px",
        widthSm: "56px",
        cell: (row) => (row.level > 0 ? row.level : "—"),
      });
    }

    if (variant === "match_top") {
      cols.push({
        key: "matchId",
        header: "Match ID",
        align: "center",
        sortable: true,
        sortType: "string",
        accessor: (row) => row.matchId ?? "",
        width: "70px",
        widthSm: "120px",
        cell: (row) => (
          <span className="block text-center font-mono text-[0.65rem] tabular-nums text-text-muted sm:text-xs">
            {row.matchId ?? "—"}
          </span>
        ),
      });
    }

    cols.push({
      key: "metric",
      header: headerLabel,
      align: "right",
      sortable: true,
      numeric: true,
      accessor: (row) => row.metricValue,
      width: "64px",
      widthSm: "110px",
      cell: (row) => row.metricValue.toLocaleString("en-US"),
    });

    return cols;
  }, [variant, headerLabel]);

  return (
    <LeaderboardTable
      ariaLabel="Challenge leaderboard"
      columns={columns}
      rows={entries}
      // Each row in match_top is a distinct match performance per player,
      // so we include matchId in the key. For the other variants matchId
      // is undefined and the rank+nickname suffix is unique.
      rowKey={(row) => `${row.rank}-${row.nickname}-${row.matchId ?? ""}`}
      isTopRank={(_row, idx, isDefaultSort) => isDefaultSort && idx === 0}
      // Tap any row → navigate to that player's summary. Same pattern
      // as the all-time leaderboards. For match_top entries, multiple
      // rows can lead to the same player's summary — that's correct
      // (each row IS a different performance by potentially the same
      // player, but the summary shows their overall stats).
      rowHref={(row) =>
        row.nickname
          ? `/player-portal/player-stats/summary?ops=${encodeURIComponent(row.nickname)}`
          : null
      }
      rowLinkAriaLabel={(row) => `View ${row.nickname}'s player summary`}
    />
  );
}

/* ---------- Rank number component ---------- */

/**
 * Renders the row's rank as #01, #02 with prize-winner emphasis.
 * For challenge tables we use isPrizeWinning instead of always
 * coloring the top 3 — only those who actually win prizes get the
 * accent-yellow.
 */
function RankNumber({ rank }: { rank: number }) {
  const label = `#${String(rank).padStart(2, "0")}`;
  return (
    <span
      className={cn(
        "font-bold tracking-tight",
        "text-[0.55rem] sm:text-xs",
        rank === 1 && "text-accent",
        rank === 2 && "text-accent-soft",
        rank === 3 && "text-accent-soft/80",
        rank > 3 && "text-text-subtle",
      )}
    >
      {label}
    </span>
  );
}
