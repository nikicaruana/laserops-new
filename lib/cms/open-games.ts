/**
 * lib/cms/open-games.ts
 * --------------------------------------------------------------------
 * Fetches the Open_Games tab from the CMS spreadsheet.
 *
 * Editors populate this sheet to manage the public match schedule that
 * appears on /events/open-games. Each row is one open game.
 *
 * Cache: 300s (5 min) — shorter than the default 1800s because the
 * match schedule changes frequently: status flips (Open → Full → Completed),
 * sign-up links go live, match reports get posted. Editors need changes
 * to surface quickly.
 *
 * Sort order: upcoming games (not Completed / Cancelled) first, sorted
 * by date ascending (nearest game on top). Then completed/cancelled games,
 * sorted by date descending (most recent completed game just below the fold).
 *
 * Rows with an empty Date cell are silently dropped.
 * --------------------------------------------------------------------
 */

import { fetchSheetAsObjects } from "@/lib/sheets";
import { CMS_URLS } from "./client";

/** Raw row shape — columns exactly as they appear in the sheet headers. */
type RawOpenGame = {
  Date: string;
  Time: string;
  Type: string;
  Signup_Link: string;
  Status: string;
  Match_Report: string;
  More_Info_Image: string;
  More_Info_Text: string;
};

/** Typed, consumer-friendly shape after parsing. */
export type OpenGame = {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM (24-hour) */
  time: string;
  /** Raw type string from sheet, e.g. "Standard", "Double XP", "Special" */
  type: string;
  /** True when the type contains "double xp" (case-insensitive). Controls red row highlight. */
  isDoubleXP: boolean;
  /** Sign-up URL, or "" if not yet published. */
  signupLink: string;
  /** "Open" | "Full" | "Completed" | "Cancelled" or any custom value the editor sets. */
  status: string;
  /** Match report URL once the match is done, or "" until then. */
  matchReportLink: string;
  /** Direct image URL for the More Info poster, or "". Image takes priority over text. */
  moreInfoImage: string;
  /** Plain text for the More Info popup when no image is set, or "". */
  moreInfoText: string;
};

const OPEN_GAMES_REVALIDATE_SECONDS = 300;

/** Status values that mean the game is no longer upcoming. */
const PAST_STATUSES = new Set(["completed", "cancelled"]);

function isPast(status: string): boolean {
  return PAST_STATUSES.has(status.toLowerCase());
}

/**
 * Normalise any date format the editor might use into YYYY-MM-DD so
 * comparisons and sorts work correctly regardless of how the sheet
 * was formatted.
 *
 * Handles:
 *   YYYY-MM-DD       → returned as-is (ISO standard)
 *   D/M/YY           → "6/6/26"    → "2026-06-06"
 *   DD/MM/YY         → "27/06/26"  → "2026-06-27"
 *   D/M/YYYY         → "6/6/2026"  → "2026-06-06"
 *   DD/MM/YYYY       → "27/06/2026" → "2026-06-27"
 *
 * Falls back to the raw string if none of the above match (sort by
 * raw string as a last resort — defensive).
 */
function toISO(dateStr: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const m = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return dateStr;
}

/**
 * Fetch and parse the Open_Games sheet.
 * Returns an empty array on any error — the page renders a graceful
 * empty state rather than throwing.
 */
export async function fetchOpenGames(): Promise<OpenGame[]> {
  const result = await fetchSheetAsObjects<RawOpenGame>(
    CMS_URLS.openGames,
    OPEN_GAMES_REVALIDATE_SECONDS,
  );

  if (!result.ok) {
    // Log server-side but don't surface to the client — empty state is shown.
    console.warn("[open-games] sheet fetch failed:", result.error);
    return [];
  }

  const games: OpenGame[] = result.rows
    .filter((r) => r.Date?.trim() !== "")
    .map((r) => ({
      date: r.Date.trim(),
      time: r.Time.trim(),
      type: r.Type.trim(),
      isDoubleXP: r.Type.trim().toLowerCase().includes("double xp"),
      signupLink: r.Signup_Link.trim(),
      status: r.Status.trim(),
      matchReportLink: r.Match_Report.trim(),
      moreInfoImage: (r.More_Info_Image ?? "").trim(),
      moreInfoText: (r.More_Info_Text ?? "").trim(),
    }));

  // Partition: upcoming vs past
  const upcoming = games.filter((g) => !isPast(g.status));
  const past = games.filter((g) => isPast(g.status));

  // Upcoming: nearest date first — normalise to ISO before comparing so
  // D/M/YY sheet dates sort correctly (e.g. "6/6/26" before "27/6/26").
  upcoming.sort((a, b) => toISO(a.date).localeCompare(toISO(b.date)));

  // Past: most recently completed first
  past.sort((a, b) => toISO(b.date).localeCompare(toISO(a.date)));

  return [...upcoming, ...past];
}

/**
 * Format a date string (YYYY-MM-DD) for display, e.g. "15 Jun 2026".
 * Returns the raw string if it can't parse (defensive).
 */
export function formatGameDate(yyyyMmDd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return yyyyMmDd;
  const d = new Date(yyyyMmDd + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return yyyyMmDd;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
