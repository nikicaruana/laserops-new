"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { HeaderInfoIcon } from "./HeaderInfoIcon";

/**
 * LeaderboardTable
 * --------------------------------------------------------------------
 * Reusable, sortable table for player-portal leaderboards.
 *
 * Architecture:
 *   - Client component — owns sort state via useState
 *   - Generic over row type T so each leaderboard supplies its own data shape
 *   - Caller defines the columns via a typed array; this component handles
 *     header rendering, sort cycling, sort indicator arrows, and row layout
 *
 * Sort cycle:
 *   - Default sort is whatever the data arrives in (caller pre-sorts on the
 *     server). When no column is actively sorted, indicator shows on no header.
 *   - Click a sortable column → sort desc on that column
 *   - Click again → sort asc
 *   - Click a third time → reset to default order
 *   - For string columns (e.g. Ops Tag) the cycle is asc → desc → reset,
 *     because alphabetical-asc is a more intuitive first-click outcome.
 *
 * Visual chrome:
 *   - Yellow top accent strip
 *   - Sticky header inside the scroll container
 *   - Subtle yellow left edge bar on rank-1 row
 *   - Hover state on rows (sets up future row-click navigation)
 *   - Tabular numerics on numeric cells via the `numeric: true` column flag
 *
 * Optional column-level info tooltip:
 *   - Set `tooltip: "..."` on any column. A small (i) icon will appear
 *     next to the header label. Click/hover reveals an explanation
 *     popover (HeaderInfoIcon). Useful for terse stat names like
 *     "Acc%", "K/D", "ELO ±", "Rating" where new players need context.
 *   - Tooltips are independent of the sort affordance — clicking the
 *     icon doesn't trigger a sort, clicking the label still does.
 */

/* ---------- Public types ---------- */

export type ColumnAlign = "left" | "center" | "right";

/**
 * Column definition.
 *   - `key`: stable id for this column. Used as the React key and as the sort key.
 *   - `header`: rendered text/element in the header cell
 *   - `align`: text alignment for both header and cells in this column
 *   - `sortable`: whether the header is clickable to sort. Default false.
 *   - `numeric`: apply tabular-nums + monospace font to cells in this column.
 *   - `sortType`: "number" or "string" — drives sort comparator and the
 *      asc/desc default direction. Default "number".
 *   - `accessor`: how to extract the sort value from a row. Defaults to
 *      `row[key]`. Provide explicitly for computed sort orders.
 *   - `width`: CSS grid track size, e.g. "32px", "minmax(0, 1fr)". Used to
 *      compose grid-template-columns. IMPORTANT: for flexible columns that
 *      may contain unbreakable text (long nicknames, URLs etc.), use
 *      "minmax(0, 1fr)" not bare "1fr". A bare 1fr track has an implicit
 *      min-content floor — unbreakable content forces it wider than its
 *      fair share, which pushes the row's other columns out of alignment
 *      with the rest of the table. minmax(0, 1fr) caps the floor at 0 so
 *      content wraps inside the cell instead.
 *   - `widthSm`: optional override at sm breakpoint. Defaults to width.
 *   - `cell`: render function for the cell content given a row.
 *   - `tooltip`: optional explanation text. When provided, an (i) info
 *      icon renders next to the header label; click/hover reveals a
 *      small popover with this text. Independent of sort behaviour.
 *   - `tooltipAriaLabel`: optional aria-label for the info icon. Defaults
 *      to "More info" — pass something more descriptive like
 *      "About match rating" when the column context isn't obvious from
 *      the surrounding label alone.
 */
export type LeaderboardColumn<T> = {
  key: string;
  header: ReactNode;
  align: ColumnAlign;
  sortable?: boolean;
  numeric?: boolean;
  sortType?: "number" | "string";
  accessor?: (row: T) => number | string;
  width: string;
  widthSm?: string;
  cell: (row: T) => ReactNode;
  tooltip?: string;
  tooltipAriaLabel?: string;
};

type LeaderboardTableProps<T> = {
  ariaLabel: string;
  columns: LeaderboardColumn<T>[];
  /** Pre-sorted rows in default order. */
  rows: T[];
  /** Stable identifier extractor for React keys. */
  rowKey: (row: T) => string;
  /**
   * Called for each row to determine if it gets the rank-1 highlight
   * (yellow left edge bar + tinted background). For most leaderboards
   * this is `(row, index) => index === 0` BUT only when sort state is default —
   * once the user re-sorts, "rank 1" no longer means the top of the table.
   */
  isTopRank?: (row: T, index: number, isDefaultSort: boolean) => boolean;
  /** Max scroll height. Defaults to ~10 rows on the larger row sizes. */
  maxHeight?: string;
  /**
   * Optional: make each row link to a destination URL (typically the
   * player's summary page). When provided, the row gets a transparent
   * absolute-positioned <Link> overlay covering the full row clickable
   * area. Returning null for a given row leaves that row non-clickable
   * (useful for rows with missing identifying data).
   */
  rowHref?: (row: T) => string | null;
  /**
   * Optional: aria-label generator for the row link overlay. Receives
   * the row and should return a screen-reader-friendly label
   * describing the destination, e.g. "View KKKyle's player summary".
   * Required if rowHref is provided.
   */
  rowLinkAriaLabel?: (row: T) => string;
};

/* ---------- Internal sort state types ---------- */

type SortDirection = "asc" | "desc";
type SortState =
  | { kind: "default" }
  | { kind: "active"; columnKey: string; direction: SortDirection };

/* ---------- Component ---------- */

export function LeaderboardTable<T>({
  ariaLabel,
  columns,
  rows,
  rowKey,
  isTopRank,
  maxHeight = "720px",
  rowHref,
  rowLinkAriaLabel,
}: LeaderboardTableProps<T>) {
  const [sort, setSort] = useState<SortState>({ kind: "default" });

  // Compose grid-template-columns CSS values from column widths.
  // Inline style — NOT Tailwind classes — because Tailwind's JIT scanner
  // can't see dynamically-built class strings, and we need the column
  // template to be derived from the typed column list rather than duplicated
  // as a literal class somewhere.
  const { mobileGrid, desktopGrid } = useMemo(() => {
    const mobile = columns.map((c) => c.width).join(" ");
    const desktop = columns.map((c) => c.widthSm ?? c.width).join(" ");
    return { mobileGrid: mobile, desktopGrid: desktop };
  }, [columns]);

  // Sorted rows derived from sort state. Pure function of rows + sort + columns.
  const displayedRows = useMemo(() => {
    if (sort.kind === "default") return rows;
    const col = columns.find((c) => c.key === sort.columnKey);
    if (!col) return rows;
    const accessor = col.accessor ?? ((r: T) => (r as Record<string, unknown>)[col.key] as number | string);
    const sortType = col.sortType ?? "number";
    const direction = sort.direction === "asc" ? 1 : -1;

    // Copy before sort — never mutate props.
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (sortType === "string") {
        // Locale-aware compare for nicknames with mixed cases / unicode
        return String(av).localeCompare(String(bv), undefined, { sensitivity: "base" }) * direction;
      }
      // Numeric
      const an = Number(av);
      const bn = Number(bv);
      // NaN sinks to bottom regardless of direction
      if (Number.isNaN(an) && Number.isNaN(bn)) return 0;
      if (Number.isNaN(an)) return 1;
      if (Number.isNaN(bn)) return -1;
      return (an - bn) * direction;
    });
    return copy;
  }, [rows, sort, columns]);

  function handleHeaderClick(col: LeaderboardColumn<T>) {
    if (!col.sortable) return;
    const initialDirection: SortDirection = (col.sortType ?? "number") === "string" ? "asc" : "desc";
    setSort((current) => {
      if (current.kind === "default") {
        return { kind: "active", columnKey: col.key, direction: initialDirection };
      }
      if (current.columnKey !== col.key) {
        // Clicked a different column — start its cycle from scratch
        return { kind: "active", columnKey: col.key, direction: initialDirection };
      }
      // Same column — advance the cycle
      if (current.direction === initialDirection) {
        // Flip direction
        return {
          kind: "active",
          columnKey: col.key,
          direction: initialDirection === "desc" ? "asc" : "desc",
        };
      }
      // Already toggled — third click resets to default
      return { kind: "default" };
    });
  }

  const isDefaultSort = sort.kind === "default";

  return (
    <div
      role="table"
      aria-label={ariaLabel}
      className="relative w-full overflow-hidden border border-border bg-bg-elevated"
      // CSS custom properties driving the grid-template-columns of every
      // .lb-row descendant. Switched between mobile and desktop values via
      // a media query in globals.css. See the .lb-row block there.
      style={
        {
          "--lb-grid": mobileGrid,
          "--lb-grid-sm": desktopGrid,
        } as React.CSSProperties
      }
    >
      {/* Inner scroll container — handles BOTH axes:
            - Vertical: rows beyond maxHeight scroll within the table
              (sticky header stays pinned, see below).
            - Horizontal: tables wider than the viewport (Match
              Summaries on mobile, with 10 columns) scroll left/right.
          Both header (in the sticky wrapper below) and body rowgroup
          use min-w-max, so they share the same width context — column
          tracks resolve to identical sizes in both, keeping headers
          aligned over their values. */}
      <div className="overflow-auto" style={{ maxHeight }}>
        {/* Sticky region — yellow strip + header row, bundled into a
            single sticky element with min-w-max so they extend the
            full grid content width (not just the visible viewport).
            min-w-max grows the wrapper to fit its grid children. For
            tables that already fit within the viewport, min-w-max
            resolves to container width — no visual change. */}
        <div className="sticky top-0 z-10 min-w-max">
          <div aria-hidden className="h-1 bg-accent" />
          {/* Header row group. Solid bg (no /95 transparency, no
              backdrop-blur) — both produced subtle grey-banding
              artifacts during horizontal scroll on iOS Safari and
              Chrome on Android. A flat colour is more honest about
              "this is the header" anyway. */}
          <div
            role="rowgroup"
            className="border-b border-border-strong bg-bg-overlay"
          >
            <div
              role="row"
              className={cn(
                "lb-row items-center gap-1 px-2 py-3 sm:gap-4 sm:px-5",
                // Mobile font tightened to 0.55rem (~8.8px) so headers like "Total XP"
                // and "XP / Match" can fit/wrap within the narrow numeric columns
                // without overlapping their neighbours. Desktop keeps the larger size.
                "text-[0.55rem] font-bold uppercase tracking-[0.12em] text-text-muted sm:text-[0.65rem] sm:tracking-[0.16em]",
              )}
            >
              {columns.map((col) => (
                <HeaderCell
                  key={col.key}
                  column={col}
                  sort={sort}
                  onClick={() => handleHeaderClick(col)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Body rows. min-w-max here matches the sticky header above
            so flex grid tracks resolve to the same widths in both
            row groups — header labels stay aligned with their column
            values when the table is wider than the viewport. Without
            this, the header (in min-w-max) and body (without it)
            would lay out in different width contexts and headers
            would shift off their columns. */}
        <div role="rowgroup" className="min-w-max">
          {displayedRows.map((row, idx) => {
            const highlight = isTopRank ? isTopRank(row, idx, isDefaultSort) : false;
            const href = rowHref ? rowHref(row) : null;
            return (
              <div
                key={rowKey(row)}
                role="row"
                className={cn(
                  "lb-row relative items-center gap-1 border-b border-border/60 px-2 py-2.5 sm:gap-4 sm:px-5 sm:py-3",
                  "transition-colors hover:bg-bg-overlay/60",
                  "last:border-b-0",
                  highlight && "bg-accent/[0.03]",
                  href && "cursor-pointer",
                )}
              >
                {highlight && (
                  <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-accent" />
                )}
                {/* Link overlay — when href is provided, an invisible <Link>
                    spans the full row, making the entire row a single
                    tap target that navigates on click.
                    z-1 puts the link above the cell content so clicks
                    anywhere on the row hit the link. Cells render at the
                    default z-0; if a future cell needs to host an
                    interactive child (its own button/link), give that
                    cell `position: relative; z-2` to claim hit priority
                    above this overlay.
                    The link itself has zero visible content — only an
                    sr-only label for screen readers. The hit area is
                    just the absolute box. */}
                {href ? (
                  <Link
                    href={href}
                    aria-label={rowLinkAriaLabel ? rowLinkAriaLabel(row) : undefined}
                    className="absolute inset-0 z-[1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                    tabIndex={0}
                  >
                    <span className="sr-only">
                      {rowLinkAriaLabel ? rowLinkAriaLabel(row) : "View row details"}
                    </span>
                  </Link>
                ) : null}
                {columns.map((col) => (
                  <DataCell key={col.key} column={col} row={row} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- Internal cell components ---------- */

const alignClass: Record<ColumnAlign, string> = {
  left: "text-left justify-self-start",
  center: "text-center justify-self-center",
  right: "text-right justify-self-end",
};

function HeaderCell<T>({
  column,
  sort,
  onClick,
}: {
  column: LeaderboardColumn<T>;
  sort: SortState;
  onClick: () => void;
}) {
  const isActive = sort.kind === "active" && sort.columnKey === column.key;
  const direction = isActive ? (sort as { direction: SortDirection }).direction : null;

  // For right-aligned numeric columns the indicator sits to the LEFT of the
  // label (outside the digits) so digits stay flush right and the indicator
  // doesn't disrupt vertical alignment of the right edge.
  // The indicator is wrapped in an inline-block with shrink-0 so it never
  // wraps onto its own line — only the label text wraps.
  const indicator = direction ? (
    <span
      aria-hidden
      className={cn(
        "inline-block shrink-0 text-[0.7em] leading-none text-accent",
        column.align === "right" ? "mr-1" : "ml-1",
      )}
    >
      {direction === "desc" ? "▼" : "▲"}
    </span>
  ) : null;

  // The label is allowed to wrap onto multiple lines if the column is
  // narrower than the header text. Indicator hugs one end via flex order;
  // the label span itself just renders normally and the browser wraps it.
  const labelEl = (
    <span className={cn("whitespace-normal", isActive && "text-accent")}>
      {column.header}
    </span>
  );

  // Optional info icon — renders only when the column declares a
  // tooltip. CRITICAL: cannot live inside the sort <button> because
  // HeaderInfoIcon renders its own <button>, and nested buttons are
  // invalid HTML (browsers handle this inconsistently — Safari and
  // Firefox break click event propagation in subtle ways). Instead
  // we render it as a sibling of the sort button, both inside the
  // columnheader flex container.
  const infoIconEl = column.tooltip ? (
    <HeaderInfoIcon
      tooltip={column.tooltip}
      ariaLabel={column.tooltipAriaLabel}
    />
  ) : null;

  // Justify content within the cell based on alignment so the wrap-group
  // stays anchored to the correct edge as it grows tall.
  const justifyClass =
    column.align === "right"
      ? "justify-end text-right"
      : column.align === "center"
        ? "justify-center text-center"
        : "justify-start text-left";

  // Sort-button inner content: just label + indicator. The info icon
  // is OUTSIDE this button (rendered as a sibling below) so the two
  // affordances stay independent and we don't nest <button>s.
  const sortButtonInner = (
    <>
      {column.align === "right" && indicator}
      {labelEl}
      {column.align !== "right" && indicator}
    </>
  );

  // Build the inner content for the columnheader. Order rules:
  //   - Right-aligned: [info icon][sort button]   — icon on the LEFT
  //     of the label so the digits below stay flush against the right
  //     edge of the column.
  //   - Left/center:   [sort button][info icon]   — icon on the right,
  //     follows the label naturally in reading order.
  //
  // The sort button is wrapped/unwrapped depending on whether the
  // column is sortable (so non-sortable columns don't render an
  // empty button shell).
  const sortContent = column.sortable ? (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // flex (not inline-flex) so the label span can wrap inside.
        // items-start keeps the indicator vertically aligned to the first
        // line of text when the label wraps to two lines.
        "flex items-start",
        justifyClass,
        "transition-colors",
        isActive ? "text-accent hover:text-accent-soft" : "hover:text-text",
        // Slightly bigger tap target without growing the row vertically too much
        "py-1",
      )}
    >
      {sortButtonInner}
    </button>
  ) : (
    // Non-sortable column: just render the inner directly, no button.
    <span className={cn("flex items-start", justifyClass)}>
      {sortButtonInner}
    </span>
  );

  return (
    <div
      role="columnheader"
      aria-sort={
        column.sortable
          ? direction === "asc"
            ? "ascending"
            : direction === "desc"
              ? "descending"
              : "none"
          : undefined
      }
      // gap-1 puts a small consistent space between the sort button
      // and the info icon. items-start matches the sort-button
      // alignment so a multi-line wrapped header keeps the icon
      // pinned to the first line.
      className={cn("flex items-start gap-1", justifyClass)}
    >
      {column.align === "right" ? (
        <>
          {infoIconEl}
          {sortContent}
        </>
      ) : (
        <>
          {sortContent}
          {infoIconEl}
        </>
      )}
    </div>
  );
}

function DataCell<T>({
  column,
  row,
}: {
  column: LeaderboardColumn<T>;
  row: T;
}) {
  return (
    <div
      role="cell"
      className={cn(
        alignClass[column.align],
        column.numeric
          ? "font-mono text-[0.7rem] tabular-nums sm:text-base"
          : "text-xs sm:text-base",
      )}
    >
      {column.cell(row)}
    </div>
  );
}
