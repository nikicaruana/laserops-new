"use client";

/**
 * components/admin/RatingLeaderboardTable.tsx
 * --------------------------------------------------------------------
 * Admin rating leaderboard: every rated player with their overall rating and
 * the 0-5 star score for each rating criterion (player_ratings). Rows arrive
 * pre-sorted by the weighted overall score; headers re-sort via
 * LeaderboardTable's desc → asc → default cycle. Rows link to the player's
 * public summary.
 */
import { useMemo } from "react";
import { cldImage } from "@/lib/cld";
import { LeaderboardTable, type LeaderboardColumn } from "@/components/portal/tables/LeaderboardTable";

export type RatingRow = {
  accountId: string;
  rank: number;
  opsTag: string;
  pic: string | null;
  overall: number | null;
  raw: number | null;
  scores: Record<string, number | null>;
};

export type Criterion = { key: string; label: string; weight: number | null };

function squareUrl(url: string, w = 64): string {
  return url.includes("/upload/") ? url.replace("/upload/", `/upload/c_fill,ar_1:1,g_auto,w_${w},q_auto,f_auto/`) : url;
}

function Stars({ n }: { n: number | null }) {
  if (n == null) return <span className="text-text-subtle">–</span>;
  return (
    <span className="whitespace-nowrap text-accent" aria-label={`${n} of 5 stars`}>
      {"★".repeat(n)}
      <span className="text-text-subtle/40">{"★".repeat(Math.max(0, 5 - n))}</span>
    </span>
  );
}

export function RatingLeaderboardTable({ rows, criteria }: { rows: RatingRow[]; criteria: Criterion[] }) {
  const columns = useMemo<LeaderboardColumn<RatingRow>[]>(
    () => [
      { key: "rank", header: "#", align: "center", sortable: true, numeric: true, accessor: (r) => -r.rank, width: "36px", cell: (r) => r.rank },
      {
        key: "player",
        header: "Player",
        align: "left",
        sortable: true,
        sortType: "string",
        accessor: (r) => r.opsTag,
        width: "minmax(150px, 1.4fr)",
        cell: (r) => (
          <span className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-bg-overlay text-[0.65rem] font-bold text-text-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {r.pic ? <img src={cldImage(squareUrl(r.pic, 64), { w: 64 })} alt="" className="h-full w-full object-cover" /> : r.opsTag.slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate text-sm font-bold text-accent">{r.opsTag}</span>
          </span>
        ),
      },
      {
        key: "overall",
        header: "Overall",
        align: "left",
        sortable: true,
        accessor: (r) => r.overall ?? -1,
        width: "96px",
        cell: (r) => <Stars n={r.overall} />,
        tooltip: "Overall star rating: the player's percentile on the weighted score, mapped to the star brackets.",
      },
      {
        key: "raw",
        header: "Score",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (r) => r.raw ?? -1,
        width: "64px",
        cell: (r) => (r.raw != null ? r.raw.toFixed(2) : "–"),
        tooltip: "Weighted score (0 to 5): each criterion's stars times its weight, summed. The default sort.",
      },
      ...criteria.map<LeaderboardColumn<RatingRow>>((c) => ({
        key: c.key,
        header: c.label,
        align: "center",
        sortable: true,
        numeric: true,
        accessor: (r) => r.scores[c.key] ?? -1,
        width: "88px",
        cell: (r) => <Stars n={r.scores[c.key]} />,
        tooltip: c.weight != null ? `${c.label}: ${Math.round(c.weight * 100)}% of the overall score.` : undefined,
      })),
    ],
    [criteria],
  );

  return (
    <LeaderboardTable
      ariaLabel="Rating leaderboard"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.accountId}
      isTopRank={(_, i, isDefault) => isDefault && i === 0}
      maxHeight="75vh"
      rowHref={(r) => `/player-portal/player-stats/summary?ops=${encodeURIComponent(r.opsTag)}`}
      rowLinkAriaLabel={(r) => `View ${r.opsTag}'s player summary`}
    />
  );
}
