"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  deriveFilterOptions,
  type PeriodRow,
} from "@/lib/leaderboards/period-shared";
import {
  aggregateAccolades,
  type AccoladesRow,
  type AccoladesPeriodFilter,
} from "@/lib/leaderboards/accolades";
import type { GameDataRow } from "@/lib/game-data/lookup";
import type { Accolade } from "@/lib/cms/accolades";
import {
  LeaderboardTable,
  type LeaderboardColumn,
} from "@/components/portal/tables/LeaderboardTable";
import { ProfilePicCell } from "@/components/portal/tables/ProfilePicCell";
import { PeriodFilter as PeriodFilterUI } from "@/components/portal/PeriodFilter";
import { cn } from "@/lib/cn";

/**
 * AccoladesLeaderboardTable
 * --------------------------------------------------------------------
 * Client component for the Accolades leaderboard.
 *
 * Columns:
 *   #  |  Profile  |  Ops Tag  |  T1  |  T2  |  T3  |  Total
 *
 * The aggregator (lib/leaderboards/accolades.ts) walks game data
 * rows and counts accolades by tier per player. Tier is derived from
 * the CMS accolade's XP value: 100=T1, 75=T2, 50=T3. Unrated XP
 * values still count toward total but no tier-specific column.
 *
 * Filter:
 *   Reads ?year and ?month from the URL — same filter URL all the
 *   other period leaderboards use, so picking April 2026 once filters
 *   every leaderboard on the page. The accolades aggregator interprets
 *   the filter against game-data row yearMonth (rather than the
 *   period sheet) since it's reading game data directly.
 *
 *   Filter dropdown options come from period rows passed in by the
 *   server wrapper — keeps the dropdown contents identical to the
 *   other leaderboards' dropdowns.
 */

type Props = {
  allRows: GameDataRow[];
  accolades: Accolade[];
  /** Period rows passed solely to derive year/month dropdown options.
   *  See server-wrapper comment for why this is separate from the
   *  data the aggregator actually consumes. */
  periodRowsForFilterOptions: PeriodRow[];
};

export function AccoladesLeaderboardTable({
  allRows,
  accolades,
  periodRowsForFilterOptions,
}: Props) {
  const searchParams = useSearchParams();

  const { years, months } = useMemo(
    () => deriveFilterOptions(periodRowsForFilterOptions),
    [periodRowsForFilterOptions],
  );

  const filter = useMemo<AccoladesPeriodFilter>(() => {
    const yearStr = searchParams.get("year");
    const monthStr = searchParams.get("month");
    const year = yearStr ? Number(yearStr) : NaN;
    const month = monthStr ? Number(monthStr) : NaN;
    return {
      year: Number.isFinite(year) && year > 0 ? year : undefined,
      monthNum:
        Number.isFinite(month) && month >= 1 && month <= 12 ? month : undefined,
    };
  }, [searchParams]);

  const displayRows = useMemo(
    () => aggregateAccolades(allRows, accolades, filter),
    [allRows, accolades, filter],
  );

  const columns = useMemo<LeaderboardColumn<AccoladesRow>[]>(
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
        width: "minmax(0, 1fr)",
        widthSm: "minmax(0, 1fr)",
        cell: (row) => (
          <span className="block text-center text-xs font-semibold leading-tight text-text [overflow-wrap:anywhere] sm:text-base">
            {row.nickname}
          </span>
        ),
      },
      {
        key: "tier1",
        // Header text swaps at the sm breakpoint: "T1" on mobile
        // (the column is only ~32px wide there, no room for the
        // full word) and "Tier 1" on desktop where the column has
        // breathing room. Same pattern for T2/T3 below. Total
        // stays "Total" on both since it already fits.
        header: (
          <>
            <span className="sm:hidden">T1</span>
            <span className="hidden sm:inline">Tier 1</span>
          </>
        ),
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.tier1,
        width: "32px",
        widthSm: "70px",
        cell: (row) => row.tier1.toLocaleString("en-US"),
      },
      {
        key: "tier2",
        header: (
          <>
            <span className="sm:hidden">T2</span>
            <span className="hidden sm:inline">Tier 2</span>
          </>
        ),
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.tier2,
        width: "32px",
        widthSm: "70px",
        cell: (row) => row.tier2.toLocaleString("en-US"),
      },
      {
        key: "tier3",
        header: (
          <>
            <span className="sm:hidden">T3</span>
            <span className="hidden sm:inline">Tier 3</span>
          </>
        ),
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.tier3,
        width: "32px",
        widthSm: "70px",
        cell: (row) => row.tier3.toLocaleString("en-US"),
      },
      {
        key: "total",
        header: "Total",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.total,
        width: "44px",
        widthSm: "70px",
        cell: (row) => row.total.toLocaleString("en-US"),
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
          ariaLabel="Accolades leaderboard"
          columns={columns}
          rows={displayRows}
          rowKey={(row) => `${row.rank}-${row.nickname}`}
          isTopRank={(_row, idx, isDefaultSort) => isDefaultSort && idx === 0}
          rowHref={(row) =>
            row.nickname
              ? `/player-portal/player-stats/summary?ops=${encodeURIComponent(row.nickname)}`
              : null
          }
          rowLinkAriaLabel={(row) => `View ${row.nickname}'s player summary`}
        />
      )}
    </>
  );
}

/* ---------- Empty state ---------- */

function EmptyResults() {
  return (
    <div className="border border-border bg-bg-elevated px-6 py-12 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
        No accolades earned
      </p>
      <p className="mt-2 text-sm text-text-subtle">
        No players have earned accolades in the selected period. Try
        changing the year or month.
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
