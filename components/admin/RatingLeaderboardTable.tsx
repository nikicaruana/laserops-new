"use client";

/**
 * components/admin/RatingLeaderboardTable.tsx
 * --------------------------------------------------------------------
 * Admin rating leaderboard: every rated player with their overall rating and,
 * per criterion, the underlying stat value next to its 0-5 rating (the same
 * icon set as RatingPill, static and in its 3+2 layout, all red at 5). Rows
 * arrive pre-sorted by the weighted overall score; criterion columns sort by
 * the stat value. Rows link to the player's public summary.
 */
import { useMemo } from "react";
import { cldImage } from "@/lib/cld";
import { LeaderboardTable, type LeaderboardColumn } from "@/components/portal/tables/LeaderboardTable";

export type CriterionCell = { stars: number | null; value: number | null };

export type RatingRow = {
  accountId: string;
  rank: number;
  opsTag: string;
  pic: string | null;
  overall: number | null;
  raw: number | null;
  cells: Record<string, CriterionCell>;
};

export type CriterionFormat = "pct" | "dec1" | "dec2" | "int" | "mmss";
export type Criterion = { key: string; label: string; tooltip: string; format: CriterionFormat; weight: number | null };

const ICON_ACTIVE = "/ratings/icon-active.png";
const ICON_ACTIVE_5STAR = "/ratings/icon-active-5star.png";
const ICON_INACTIVE = "/ratings/icon-inactive.png";

function squareUrl(url: string, w = 64): string {
  return url.includes("/upload/") ? url.replace("/upload/", `/upload/c_fill,ar_1:1,g_auto,w_${w},q_auto,f_auto/`) : url;
}

function fmt(v: number | null, f: CriterionFormat): string {
  if (v == null || Number.isNaN(v)) return "–";
  switch (f) {
    case "pct": return `${Math.round(v * 100)}%`;
    case "dec1": return v.toFixed(1);
    case "dec2": return v.toFixed(2);
    case "int": return Math.round(v).toLocaleString("en-US");
    case "mmss": {
      const s = Math.round(v);
      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    }
  }
}

/** Compact static rating icons in the site's 3+2 layout. */
function RatingIcons({ stars, size = "h-2.5 w-2.5" }: { stars: number | null; size?: string }) {
  if (stars == null) return <span className="text-text-subtle">–</span>;
  const active = stars === 5 ? ICON_ACTIVE_5STAR : ICON_ACTIVE;
  const icon = (i: number) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={i} src={i < stars ? active : ICON_INACTIVE} alt="" aria-hidden className={`block ${size}`} />
  );
  return (
    <span className="flex shrink-0 flex-col items-center gap-px" role="img" aria-label={`${stars} of 5`}>
      <span className="flex gap-px">{[0, 1, 2].map(icon)}</span>
      <span className="flex gap-px">{[3, 4].map(icon)}</span>
    </span>
  );
}

export function RatingLeaderboardTable({ rows, criteria }: { rows: RatingRow[]; criteria: Criterion[] }) {
  const columns = useMemo<LeaderboardColumn<RatingRow>[]>(
    () => [
      { key: "rank", header: "#", align: "center", sortable: true, numeric: true, accessor: (r) => -r.rank, width: "24px", cell: (r) => r.rank },
      {
        key: "player",
        header: "Player",
        align: "left",
        sortable: true,
        sortType: "string",
        accessor: (r) => r.opsTag,
        width: "minmax(110px, 1fr)",
        cell: (r) => (
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-bg-overlay text-[0.6rem] font-bold text-text-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {r.pic ? <img src={cldImage(squareUrl(r.pic, 64), { w: 64 })} alt="" className="h-full w-full object-cover" /> : r.opsTag.slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate text-[0.8rem] font-bold text-accent">{r.opsTag}</span>
          </span>
        ),
      },
      {
        key: "overall",
        header: "Overall",
        align: "left",
        sortable: true,
        numeric: true,
        accessor: (r) => r.raw ?? -1,
        width: "74px",
        cell: (r) => (
          <span className="flex items-center gap-1.5">
            <RatingIcons stars={r.overall} size="h-3 w-3" />
            <span className="text-[0.8rem] font-bold tabular-nums text-text">{r.raw != null ? r.raw.toFixed(2) : "–"}</span>
          </span>
        ),
        tooltip: "Overall rating and weighted score (0 to 5): each criterion's rating times its weight, summed. The default sort.",
      },
      ...criteria.map<LeaderboardColumn<RatingRow>>((c) => ({
        key: c.key,
        header: c.label,
        align: "left",
        sortable: true,
        numeric: true,
        accessor: (r) => r.cells[c.key]?.value ?? -1,
        width: "70px",
        cell: (r) => (
          <span className="flex items-center gap-1.5">
            <RatingIcons stars={r.cells[c.key]?.stars ?? null} />
            <span className="text-[0.75rem] tabular-nums text-text">{fmt(r.cells[c.key]?.value ?? null, c.format)}</span>
          </span>
        ),
        tooltip: c.weight != null ? `${c.tooltip} Weight: ${Math.round(c.weight * 100)}% of the overall score.` : c.tooltip,
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
      maxHeight="78vh"
      dense
      rowHref={(r) => `/player-portal/player-stats/summary?ops=${encodeURIComponent(r.opsTag)}`}
      rowLinkAriaLabel={(r) => `View ${r.opsTag}'s player summary`}
    />
  );
}
