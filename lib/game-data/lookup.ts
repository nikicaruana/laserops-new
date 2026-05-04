/**
 * lib/game-data/lookup.ts
 * --------------------------------------------------------------------
 * Fetch and parse Game_Data_Lookup_PUBLIC — the per-match data sheet.
 *
 * One row per player per match, fully granular. Used for challenges
 * where individual match performances matter (e.g. "highest kills in
 * a single match"), as opposed to the period-stats sheet which is
 * already aggregated per month.
 *
 * Naming convention here mirrors period-shared.ts so anyone reading
 * both knows what to expect.
 */

import {
  fetchSheetAsObjects,
  parseNumericOr,
  type SheetFetchResult,
} from "@/lib/sheets";
import { FALLBACK_PROFILE_PIC } from "@/lib/leaderboards/period-shared";

/** Public — same spreadsheet as the period stats / player stats sheets. */
export const GAME_DATA_LOOKUP_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTTLlM4fIfh52DiovbJT2b9A6UyqoiQtoG0c2HoVRCG_OCtLPZvz-uBSC6y1voM8d4jBVCNcpCGctco/pub?gid=116322811&single=true&output=csv";

/**
 * Raw row from Game_Data_Lookup. Only the columns we know we'll consume
 * are typed; anything else is reachable via the index signature.
 */
export type GameDataRaw = Record<string, string> & {
  LaserOps_Nickname: string;
  LaserOps_Profile_Image: string;
  LaserOps_Game_YearMonth: string;
  LaserOps_Match_ID: string;
  XP_Level_Current_Badge_URL: string;
};

/**
 * Parsed game data row. The raw row is preserved so per-challenge
 * metric extraction can read arbitrary columns by name (since the CMS
 * specifies which column to rank by — could be any of dozens).
 */
export type GameDataRow = {
  nickname: string;
  profilePicUrl: string;
  yearMonth: string;
  matchId: string;
  rankBadgeUrl: string;
  raw: GameDataRaw;
};

/**
 * Fetch and normalise the game data lookup sheet.
 * Cached 5 min (matches the data sheets — granular match data could
 * grow as new matches are recorded).
 */
export async function fetchGameDataRows(): Promise<SheetFetchResult<GameDataRow>> {
  const result = await fetchSheetAsObjects<GameDataRaw>(GAME_DATA_LOOKUP_CSV_URL);
  if (!result.ok) return result;

  const rows: GameDataRow[] = result.rows
    .filter((r) => r.LaserOps_Nickname && r.LaserOps_Nickname.trim() !== "")
    .map((r) => {
      const profileRaw = r.LaserOps_Profile_Image?.trim();
      const sourceYearMonth = r.LaserOps_Game_YearMonth?.trim() ?? "";
      // YearMonth normalisation — same logic as period-shared. If the
      // source isn't already YYYY-MM, leave it as-is and let filtering
      // miss it (defensive: better than fabricating dates).
      const yearMonth = /^\d{4}-\d{2}$/.test(sourceYearMonth) ? sourceYearMonth : "";
      return {
        nickname: r.LaserOps_Nickname.trim(),
        profilePicUrl: profileRaw && profileRaw !== "" ? profileRaw : FALLBACK_PROFILE_PIC,
        yearMonth,
        matchId: (r.LaserOps_Match_ID ?? "").trim(),
        rankBadgeUrl: (r.XP_Level_Current_Badge_URL ?? "").trim(),
        raw: r,
      };
    });

  if (rows.length === 0) {
    return { ok: false, error: "Game data lookup sheet returned no usable rows." };
  }
  return { ok: true, rows };
}

/**
 * Filter game data rows to a set of YearMonths.
 * Used by challenges to scope to the active season's window.
 */
export function filterByMonths(rows: GameDataRow[], months: string[]): GameDataRow[] {
  if (months.length === 0) return [];
  const set = new Set(months);
  return rows.filter((r) => set.has(r.yearMonth));
}

/** Helper to read a numeric column from a raw row, with default. */
export function readNumeric(row: GameDataRow, columnName: string, defaultValue = 0): number {
  return parseNumericOr(row.raw[columnName], defaultValue);
}

/**
 * Filter rows to a single match. Case-insensitive match-id comparison
 * so user input variations resolve.
 */
export function findMatchRows(rows: GameDataRow[], matchId: string): GameDataRow[] {
  const needle = matchId.trim().toLowerCase();
  if (needle === "") return [];
  return rows.filter((r) => r.matchId.toLowerCase() === needle);
}
