/**
 * period-shared.ts
 * --------------------------------------------------------------------
 * Shared types and helpers for the Leaderboard_Period_Stats sheet.
 *
 * That sheet has one row per player per month. Multiple leaderboards
 * (Match/Round Wins, Total Points, Accolades, etc.) all read from this
 * same source with different aggregations and filter applied on top.
 *
 * Conventions:
 *   - All filter-relevant numerics (year, month_num) are parsed to integers
 *     once during fetch — defensively, since CSV values can come as floats
 *     ("2026.00") or zero-padded strings.
 *   - YearMonth strings are normalised to "YYYY-MM" for stable grouping.
 *   - We keep the raw stat columns as strings until each leaderboard's
 *     aggregator parses them — different tables care about different stats.
 */

import {
  fetchSheetAsObjects,
  parseNumericOr,
  type SheetFetchResult,
} from "@/lib/sheets";

/** Public — anyone with this URL can read the leaderboard tab. */
export const PERIOD_STATS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTTLlM4fIfh52DiovbJT2b9A6UyqoiQtoG0c2HoVRCG_OCtLPZvz-uBSC6y1voM8d4jBVCNcpCGctco/pub?gid=1977569856&single=true&output=csv";

export const FALLBACK_PROFILE_PIC =
  "https://i.postimg.cc/sxy2jVMR/Generic-Ops-Profile-Pic.png";

/**
 * Raw row shape from the period-stats sheet, all values still strings.
 * Only the columns we actually consume are typed; the rest are reachable
 * via the index signature for ad-hoc use.
 */
export type PeriodStatsRaw = Record<string, string> & {
  LaserOps_Nickname: string;
  LaserOps_Profile_Image: string;
  LaserOps_Game_Year: string;
  LaserOps_Game_Month_Num: string;
  LaserOps_Game_Month: string;
  LaserOps_Game_YearMonth: string;
};

/**
 * Period row with parsed numerics. Use this throughout the table layer —
 * the raw shape is only inside the fetcher.
 */
export type PeriodRow = {
  /** Trimmed nickname. */
  nickname: string;
  /** Profile image URL or fallback. */
  profilePicUrl: string;
  /** Year as integer (e.g. 2026). */
  year: number;
  /** Month as integer 1-12. */
  monthNum: number;
  /** Human label, e.g. "April". */
  monthName: string;
  /** Normalised "YYYY-MM" key. Useful for grouping or display. */
  yearMonth: string;
  /** All other stat columns kept as strings — parse on demand per leaderboard. */
  raw: PeriodStatsRaw;
};

/**
 * Fetch and normalise the period-stats sheet into PeriodRows. Cached for
 * 5 minutes by the underlying Next.js fetch. Server-side only.
 */
export async function fetchPeriodRows(): Promise<SheetFetchResult<PeriodRow>> {
  const result = await fetchSheetAsObjects<PeriodStatsRaw>(PERIOD_STATS_CSV_URL);
  if (!result.ok) return result;

  const rows: PeriodRow[] = result.rows
    .filter((r) => r.LaserOps_Nickname && r.LaserOps_Nickname.trim() !== "")
    .map((r) => {
      const profileRaw = r.LaserOps_Profile_Image?.trim();
      // year may arrive as "2026.00" (Sheets float formatting) — round to int.
      const year = Math.trunc(parseNumericOr(r.LaserOps_Game_Year, 0));
      const monthNum = Math.trunc(parseNumericOr(r.LaserOps_Game_Month_Num, 0));
      // Normalise YearMonth to "YYYY-MM" regardless of source format.
      // Trust the source if it already matches; otherwise derive from year+month.
      const sourceYearMonth = r.LaserOps_Game_YearMonth?.trim() ?? "";
      const yearMonth =
        /^\d{4}-\d{2}$/.test(sourceYearMonth)
          ? sourceYearMonth
          : `${String(year).padStart(4, "0")}-${String(monthNum).padStart(2, "0")}`;
      return {
        nickname: r.LaserOps_Nickname.trim(),
        profilePicUrl: profileRaw && profileRaw !== "" ? profileRaw : FALLBACK_PROFILE_PIC,
        year,
        monthNum,
        monthName: r.LaserOps_Game_Month?.trim() ?? "",
        yearMonth,
        raw: r,
      };
    });

  if (rows.length === 0) {
    return { ok: false, error: "Period stats sheet returned no usable rows." };
  }
  return { ok: true, rows };
}

/* ---------- Filter primitives ---------- */

/**
 * Filter selection — both fields independently optional.
 *   - year: undefined means "all years"
 *   - monthNum: undefined means "all months"
 *
 * Cartesian: All/All, Year/All, All/Month, Year/Month all valid.
 * "All/Month" is a slightly odd combination (April-from-every-year) but
 * we honour it rather than refuse it.
 */
export type PeriodFilter = {
  year?: number;
  monthNum?: number;
};

/** Apply a PeriodFilter to a list of PeriodRows. */
export function applyPeriodFilter(rows: PeriodRow[], filter: PeriodFilter): PeriodRow[] {
  if (filter.year === undefined && filter.monthNum === undefined) {
    return rows;
  }
  return rows.filter((r) => {
    if (filter.year !== undefined && r.year !== filter.year) return false;
    if (filter.monthNum !== undefined && r.monthNum !== filter.monthNum) return false;
    return true;
  });
}

/* ---------- Filter option derivation ---------- */

/** A filter option as rendered in the dropdown UI. */
export type FilterOption<V> = {
  value: V;
  label: string;
};

/**
 * Derive available year and month options from the actual data.
 *
 * Years come from the unique set of years present, sorted descending
 * (most recent first — most users want to see this year's stats).
 *
 * Months come from the unique set of (monthNum → monthName) pairs present,
 * sorted by monthNum 1..12. We use the *names* from the data itself rather
 * than hardcoding so any localisation/spelling decisions made in the sheet
 * are reflected here.
 */
export function deriveFilterOptions(rows: PeriodRow[]): {
  years: FilterOption<number>[];
  months: FilterOption<number>[];
} {
  const yearSet = new Set<number>();
  const monthMap = new Map<number, string>();

  for (const r of rows) {
    if (r.year > 0) yearSet.add(r.year);
    if (r.monthNum >= 1 && r.monthNum <= 12 && r.monthName) {
      // Last-write-wins is fine since names should be consistent per month.
      monthMap.set(r.monthNum, r.monthName);
    }
  }

  const years = [...yearSet]
    .sort((a, b) => b - a)
    .map((y) => ({ value: y, label: String(y) }));

  const months = [...monthMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([num, name]) => ({ value: num, label: name }));

  return { years, months };
}
