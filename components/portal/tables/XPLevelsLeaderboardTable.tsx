"use client";

import { useMemo } from "react";
import { type XpLevelsRow } from "@/lib/leaderboards/xp-levels";
import {
  LeaderboardTable,
  type LeaderboardColumn,
} from "@/components/portal/tables/LeaderboardTable";
import { ProfilePicCell } from "@/components/portal/tables/ProfilePicCell";
import { RankBadgeCell } from "@/components/portal/tables/RankBadgeCell";
import { cn } from "@/lib/cn";

/**
 * XPLevelsLeaderboardTable — client-side render of the All-Time XP/Levels
 * leaderboard. Receives pre-sorted rows from the server component and owns
 * sort interactivity.
 *
 * Column shape (7 columns, mobile → desktop):
 *   #  |  Profile  |  Ops Tag  |  Rank Badge  |  Lvl  |  Total XP  |  XP / Match
 *
 * Why a dedicated Profile column:
 *   Photos are uniform-sized so they line up vertically as a clean stack —
 *   matches the visual rhythm of the badge column. Previously the photo was
 *   sandwiched into the Ops Tag column, breaking that rhythm and crowding
 *   long nicknames.
 *
 * All headers except `#` and Profile are sortable. `#` reflects current
 * sort-order row position; Profile has nothing meaningful to sort on.
 */

type Props = {
  rows: XpLevelsRow[];
};

export function XPLevelsLeaderboardTable({ rows }: Props) {
  const columns = useMemo<LeaderboardColumn<XpLevelsRow>[]>(
    () => [
      {
        key: "rank",
        header: "#",
        align: "center",
        sortable: false,
        numeric: true,
        // Mobile: 22px (shrunk from 28). Desktop: 40px (shrunk from 56).
        // Both fit "#01" through "#50" comfortably at the chosen font sizes.
        width: "22px",
        widthSm: "40px",
        cell: (row) => <RankNumber rank={row.rank} />,
      },
      {
        key: "profile",
        header: "",
        align: "center",
        sortable: false,
        // Image-only column — width matches the image's intrinsic size so the
        // photos stack uniformly down the column.
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
        // Flex column — takes whatever's left after fixed widths
        width: "1fr",
        widthSm: "1fr",
        cell: (row) => (
          // break-words allows long single-word nicknames (no spaces) to
          // wrap to multiple lines on narrow viewports rather than overflow
          // or get truncated. text-center keeps wrapped lines visually
          // centered within the column.
          <span className="block break-words text-center text-xs font-semibold leading-tight text-text sm:text-base">
            {row.nickname}
          </span>
        ),
      },
      {
        key: "rankBadge",
        header: "Rank",
        align: "center",
        // Sorted by level — the badge IS the level visually, so sorting by
        // level here matches user expectation when they click this column.
        sortable: true,
        accessor: (row) => row.level,
        // Mobile: 36px just fits the badge image (also 36px tall, ~36-40px wide)
        // Desktop: 80px gives the bigger 60px badge breathing room
        width: "36px",
        widthSm: "80px",
        cell: (row) => (
          <RankBadgeCell
            badgeUrl={row.rankBadgeUrl}
            ariaLabel={`Rank badge for ${row.nickname}`}
          />
        ),
      },
      {
        key: "level",
        header: "Lvl",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.level,
        width: "22px",
        widthSm: "56px",
        cell: (row) => row.level,
      },
      {
        key: "totalXp",
        header: "Total XP",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.totalXp,
        // 64px on mobile fits 6-digit numbers like "100,000" and gives the
        // header "Total XP" room to wrap to two lines if needed.
        width: "64px",
        widthSm: "110px",
        cell: (row) => row.totalXp.toLocaleString("en-US"),
      },
      {
        key: "xpPerMatch",
        // Spaces around the slash so the header has a natural wrap opportunity
        // ("XP /" + "Match" on two lines if column is narrow). "XP/Match"
        // without spaces would refuse to wrap.
        header: "XP / Match",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.xpPerMatch,
        width: "58px",
        widthSm: "100px",
        cell: (row) => Math.round(row.xpPerMatch).toLocaleString("en-US"),
      },
    ],
    [],
  );

  return (
    <LeaderboardTable
      ariaLabel="All-time XP / Levels leaderboard"
      columns={columns}
      rows={rows}
      rowKey={(row) => `${row.rank}-${row.nickname}`}
      // Highlight the rank-1 row only in default sort. Once the user sorts
      // by a different column, the row at index 0 isn't necessarily rank 1
      // anymore, so the yellow bar would mislead.
      isTopRank={(_row, idx, isDefaultSort) => isDefaultSort && idx === 0}
    />
  );
}

/* ---------- Rank number ---------- */

/**
 * Renders the row's rank as #01, #02, ... with color emphasis for top 3.
 * The `rank` is the original-data rank (XP-desc position), not the current
 * display position — so a Level 5 player who's #07 in XP stays "#07" even
 * when the user sorts by some other column.
 */
function RankNumber({ rank }: { rank: number }) {
  const label = `#${String(rank).padStart(2, "0")}`;
  return (
    <span
      className={cn(
        "font-bold tracking-tight",
        // Smaller on mobile so 3-character labels fit in the 22px column
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
