"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  applyPeriodFilter,
  deriveFilterOptions,
  type PeriodRow,
  type PeriodFilter,
} from "@/lib/leaderboards/period-shared";
import { aggregateDamage, type DamageRow } from "@/lib/leaderboards/damage";
import {
  LeaderboardTable,
  type LeaderboardColumn,
} from "@/components/portal/tables/LeaderboardTable";
import { ProfilePicCell } from "@/components/portal/tables/ProfilePicCell";
import { PeriodFilter as PeriodFilterUI } from "@/components/portal/PeriodFilter";
import { cn } from "@/lib/cn";

/**
 * DamageLeaderboardTable
 * --------------------------------------------------------------------
 * Client component for the Damage leaderboard.
 *
 * Columns:
 *   #  |  Profile  |  Ops Tag  |  Total Damage  |  Damage / Match
 *
 * Numeric formatting:
 *   - Total Damage: integer with thousands separator (damage values
 *     can grow into the high tens of thousands).
 *   - Damage/Match: rounded integer — fractional damage doesn't
 *     communicate anything meaningful at the precision players care
 *     about.
 */

type Props = {
  allRows: PeriodRow[];
};

export function DamageLeaderboardTable({ allRows }: Props) {
  const searchParams = useSearchParams();

  const { years, months } = useMemo(
    () => deriveFilterOptions(allRows),
    [allRows],
  );

  const filter = useMemo<PeriodFilter>(() => {
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

  const displayRows = useMemo(() => {
    const filtered = applyPeriodFilter(allRows, filter);
    return aggregateDamage(filtered);
  }, [allRows, filter]);

  const columns = useMemo<LeaderboardColumn<DamageRow>[]>(
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
        key: "totalDamage",
        header: "Total Damage",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.totalDamage,
        // 70px on mobile fits 5-6 digit damage values with separators.
        width: "70px",
        widthSm: "110px",
        cell: (row) => row.totalDamage.toLocaleString("en-US"),
      },
      {
        key: "damagePerMatch",
        header: "Damage / Match",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.damagePerMatch,
        width: "60px",
        widthSm: "110px",
        cell: (row) =>
          Math.round(row.damagePerMatch).toLocaleString("en-US"),
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
          ariaLabel="Damage leaderboard"
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
