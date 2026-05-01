"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  applyPeriodFilter,
  deriveFilterOptions,
  type PeriodRow,
  type PeriodFilter,
} from "@/lib/leaderboards/period-shared";
import {
  aggregateMatchRoundWins,
  type MatchRoundWinsRow,
} from "@/lib/leaderboards/match-round-wins";
import {
  LeaderboardTable,
  type LeaderboardColumn,
} from "@/components/portal/tables/LeaderboardTable";
import { ProfilePicCell } from "@/components/portal/tables/ProfilePicCell";
import { PeriodFilter as PeriodFilterUI } from "@/components/portal/PeriodFilter";
import { cn } from "@/lib/cn";

/**
 * MatchRoundWinsLeaderboardTable
 * --------------------------------------------------------------------
 * Client component for the Match / Round Wins leaderboard.
 *
 * Receives all PeriodRows from the server and owns:
 *   - Reading Year/Month from URL search params
 *   - Filtering rows to the selected window
 *   - Aggregating per-player (sum across months in window)
 *   - Sortable columns (default sort: Match Wins desc)
 *   - The dropdown filter UI rendered above the table
 *
 * Column shape (6 columns, mobile → desktop):
 *   #  |  Profile  |  Ops Tag  |  Match Wins  |  Round Wins  |  Round Win Rate
 *
 * One fewer column than XP/Levels (no rank badge) so the Ops Tag column
 * gets a bit more room for nicknames.
 */

type Props = {
  allRows: PeriodRow[];
};

export function MatchRoundWinsLeaderboardTable({ allRows }: Props) {
  const searchParams = useSearchParams();

  // Derive dropdown options from the data — show only years/months that
  // actually appear in the sheet, so users can't pick combinations that
  // would yield an empty leaderboard.
  const { years, months } = useMemo(
    () => deriveFilterOptions(allRows),
    [allRows],
  );

  // Parse the current filter from URL params. Empty/invalid → undefined,
  // which means "no filter on that field".
  const filter = useMemo<PeriodFilter>(() => {
    const yearStr = searchParams.get("year");
    const monthStr = searchParams.get("month");
    const year = yearStr ? Number(yearStr) : NaN;
    const month = monthStr ? Number(monthStr) : NaN;
    return {
      year: Number.isFinite(year) && year > 0 ? year : undefined,
      monthNum: Number.isFinite(month) && month >= 1 && month <= 12 ? month : undefined,
    };
  }, [searchParams]);

  // Filter then aggregate. Both are pure, recompute when inputs change.
  const displayRows = useMemo(() => {
    const filtered = applyPeriodFilter(allRows, filter);
    return aggregateMatchRoundWins(filtered);
  }, [allRows, filter]);

  const columns = useMemo<LeaderboardColumn<MatchRoundWinsRow>[]>(
    () => [
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
        // minmax(0, 1fr) caps the column so unbreakable nicknames wrap inside
        // rather than expanding the track and misaligning the rest of the row.
        width: "minmax(0, 1fr)",
        widthSm: "minmax(0, 1fr)",
        cell: (row) => (
          <span className="block text-center text-xs font-semibold leading-tight text-text [overflow-wrap:anywhere] sm:text-base">
            {row.nickname}
          </span>
        ),
      },
      {
        key: "matchWins",
        header: "Match Wins",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.matchWins,
        width: "56px",
        widthSm: "90px",
        cell: (row) => row.matchWins.toLocaleString("en-US"),
      },
      {
        key: "roundWins",
        header: "Round Wins",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.roundWins,
        width: "56px",
        widthSm: "90px",
        cell: (row) => row.roundWins.toLocaleString("en-US"),
      },
      {
        key: "roundWinRate",
        header: "Round Win Rate",
        align: "right",
        sortable: true,
        numeric: true,
        // Sort with nulls (no rounds played) at the bottom regardless of
        // direction. The base table comparator already handles NaN-as-bottom;
        // map null → NaN here so it inherits that behaviour.
        accessor: (row) => (row.roundWinRate === null ? NaN : row.roundWinRate),
        width: "60px",
        widthSm: "110px",
        cell: (row) =>
          row.roundWinRate === null
            ? "—"
            : `${Math.round(row.roundWinRate)}%`,
      },
    ],
    [],
  );

  return (
    <>
      <PeriodFilterUI years={years} months={months} />
      {displayRows.length === 0 ? (
        <EmptyResults />
      ) : (
        <LeaderboardTable
          ariaLabel="Match and round wins leaderboard"
          columns={columns}
          rows={displayRows}
          rowKey={(row) => `${row.rank}-${row.nickname}`}
          isTopRank={(_row, idx, isDefaultSort) => isDefaultSort && idx === 0}
        />
      )}
    </>
  );
}

/* ---------- Empty state ---------- */

/**
 * Shown when the filter produces zero matching rows. Distinct from the
 * server-side error state — this means "data loaded fine but the filter
 * window has no players."
 */
function EmptyResults() {
  return (
    <div className="border border-border bg-bg-elevated px-6 py-12 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
        No matches found
      </p>
      <p className="mt-2 text-sm text-text-subtle">
        No players match the selected period. Try changing the year or month.
      </p>
    </div>
  );
}

/* ---------- Rank number ---------- */

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
