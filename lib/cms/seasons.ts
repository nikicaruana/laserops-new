import { fetchSheetAsObjects, parseNumericOr } from "@/lib/sheets";
import { CMS_REVALIDATE_SECONDS, CMS_URLS } from "./client";

/**
 * Raw shape of a Seasons row, exactly as the CMS publishes it.
 * All fields are strings since CSV doesn't preserve types.
 */
type SeasonRaw = Record<string, string> & {
  Season_Number: string;
  Season_Name: string;
  Start_YearMonth: string;
  End_YearMonth: string;
  Status: string;
  Terms_And_Conditions: string;
};

/**
 * Typed Season after parsing. Used by the rest of the app.
 */
export type Season = {
  number: number;
  name: string;
  /** Inclusive start in YYYY-MM format. */
  startYearMonth: string;
  /** Inclusive end in YYYY-MM format. */
  endYearMonth: string;
  status: SeasonStatus;
  termsAndConditions: string;
  /**
   * All YYYY-MM strings between start and end (inclusive). Pre-computed
   * so consumers don't repeatedly walk dates. Used as the filter set
   * against LaserOps_Game_YearMonth in period/match data.
   */
  monthsInWindow: string[];
};

export type SeasonStatus = "upcoming" | "active" | "completed";

/**
 * Fetch all seasons from the CMS.
 *
 * Result is sorted by Season_Number ascending. Rows with non-numeric
 * Season_Number are dropped silently (defensive: avoid breaking the page
 * if someone accidentally adds a header-like row twice).
 */
export async function fetchSeasons(): Promise<Season[]> {
  const result = await fetchSheetAsObjects<SeasonRaw>(
    CMS_URLS.seasons,
    CMS_REVALIDATE_SECONDS,
  );
  if (!result.ok) {
    return [];
  }

  const seasons: Season[] = [];
  for (const row of result.rows) {
    const number = parseNumericOr(row.Season_Number, NaN);
    if (!Number.isFinite(number)) continue;

    const status = normalizeStatus(row.Status);
    const startYearMonth = (row.Start_YearMonth ?? "").trim();
    const endYearMonth = (row.End_YearMonth ?? "").trim();
    if (!isValidYearMonth(startYearMonth) || !isValidYearMonth(endYearMonth)) {
      continue;
    }

    seasons.push({
      number,
      name: (row.Season_Name ?? "").trim(),
      startYearMonth,
      endYearMonth,
      status,
      termsAndConditions: (row.Terms_And_Conditions ?? "").trim(),
      monthsInWindow: enumerateMonths(startYearMonth, endYearMonth),
    });
  }

  return seasons.sort((a, b) => a.number - b.number);
}

/**
 * Find the season the site should currently feature.
 *
 * Priority:
 *   1. The first row with Status === "active". (If multiple, the lowest
 *      Season_Number wins — but you should aim to keep exactly one.)
 *   2. If none active, the most recent "completed" season (acts as Hall
 *      of Fame between seasons).
 *   3. If still nothing, undefined — caller decides whether to hide the
 *      section or show an empty state.
 */
export function getActiveSeason(seasons: Season[]): Season | undefined {
  const active = seasons.find((s) => s.status === "active");
  if (active) return active;

  // Most recent completed season = highest Season_Number among completed
  const completed = seasons
    .filter((s) => s.status === "completed")
    .sort((a, b) => b.number - a.number);
  return completed[0];
}

/* ---------- internals ---------- */

function normalizeStatus(raw: string | undefined): SeasonStatus {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "active" || value === "upcoming" || value === "completed") {
    return value;
  }
  // Defensive default: treat unknown statuses as "upcoming" so we don't
  // accidentally pick them as the active season.
  return "upcoming";
}

const YEAR_MONTH_REGEX = /^\d{4}-\d{2}$/;

function isValidYearMonth(value: string): boolean {
  if (!YEAR_MONTH_REGEX.test(value)) return false;
  const [yearStr, monthStr] = value.split("-");
  const month = Number(monthStr);
  return month >= 1 && month <= 12;
}

/**
 * Enumerate all YYYY-MM values from start to end inclusive.
 * Both inputs are assumed valid (caller checks first).
 */
function enumerateMonths(start: string, end: string): string[] {
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);

  const out: string[] = [];
  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    out.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    // Defensive cap: don't infinite-loop if the dates are mis-ordered.
    if (out.length > 240) break;
  }
  return out;
}
