/**
 * xp-levels.ts — typed shape and fetcher for the All-Time XP / Levels
 * leaderboard.
 *
 * Pulls from the Player_Stats tab (one row per player, pre-aggregated).
 * Sorts by XP_Total desc, tiebreaks by XP_Average_XP_Per_Match desc.
 * Returns the top 50 players. Top 10 visible in the UI viewport;
 * the table component handles the scroll-to-50 cap.
 */

import {
  fetchSheetAsObjects,
  parseNumericOr,
  type SheetFetchResult,
} from "@/lib/sheets";

/** Public, intentionally — anyone with this URL can read the leaderboard tab. */
const PLAYER_STATS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTTLlM4fIfh52DiovbJT2b9A6UyqoiQtoG0c2HoVRCG_OCtLPZvz-uBSC6y1voM8d4jBVCNcpCGctco/pub?gid=746018421&single=true&output=csv";

/** Fallback profile pic, mirrors the calculated field used in Looker. */
export const FALLBACK_PROFILE_PIC =
  "https://i.postimg.cc/sxy2jVMR/Generic-Ops-Profile-Pic.png";

/** Cap displayed players. Top 10 visible in viewport, scroll to see up to 50. */
const DISPLAY_LIMIT = 50;

/**
 * Subset of Player_Stats columns we actually use for the XP/Levels view.
 * The fetcher returns all columns (typed loosely as Record<string, string>);
 * this shape narrows to what the table cares about, with numerics parsed.
 */
export type XpLevelsRow = {
  rank: number; // derived from sort position, 1-indexed
  nickname: string;
  profilePicUrl: string; // already falls back if source was empty
  rankBadgeUrl: string;
  level: number;
  totalXp: number;
  xpPerMatch: number;
};

/**
 * Raw shape of a row in Player_Stats — every column we might reference,
 * still as strings (CSV native).
 */
type PlayerStatsRaw = Record<string, string> & {
  Player_Stats_Nickname: string;
  Player_Stats_Profile_Pic: string;
  XP_Current_Rank_Badge_URL: string;
  XP_Current_Level: string;
  XP_Total: string;
  XP_Average_XP_Per_Match: string;
};

/**
 * Fetch, parse, sort, and trim the Player_Stats data into the shape
 * the All-Time XP/Levels leaderboard needs.
 */
export async function fetchXpLevelsLeaderboard(): Promise<SheetFetchResult<XpLevelsRow>> {
  const result = await fetchSheetAsObjects<PlayerStatsRaw>(PLAYER_STATS_CSV_URL);
  if (!result.ok) return result;

  const sorted = result.rows
    .filter((row) => {
      // Drop rows with no nickname — defensive against blank trailing rows
      // or accidental empty inserts in the source sheet.
      return row.Player_Stats_Nickname && row.Player_Stats_Nickname.trim() !== "";
    })
    .map((row): { row: PlayerStatsRaw; xp: number; xpPerMatch: number } => ({
      row,
      // Pre-compute the numeric values used both for sorting and final shape
      // so we don't parse twice.
      xp: parseNumericOr(row.XP_Total, 0),
      xpPerMatch: parseNumericOr(row.XP_Average_XP_Per_Match, 0),
    }))
    .sort((a, b) => {
      // Primary: XP_Total desc
      if (b.xp !== a.xp) return b.xp - a.xp;
      // Tiebreak: XP_Average_XP_Per_Match desc
      return b.xpPerMatch - a.xpPerMatch;
    })
    .slice(0, DISPLAY_LIMIT)
    .map(({ row, xp, xpPerMatch }, index): XpLevelsRow => {
      const profilePicRaw = row.Player_Stats_Profile_Pic?.trim();
      return {
        rank: index + 1,
        nickname: row.Player_Stats_Nickname.trim(),
        profilePicUrl: profilePicRaw && profilePicRaw !== "" ? profilePicRaw : FALLBACK_PROFILE_PIC,
        rankBadgeUrl: row.XP_Current_Rank_Badge_URL?.trim() ?? "",
        level: parseNumericOr(row.XP_Current_Level, 0),
        totalXp: xp,
        xpPerMatch: xpPerMatch,
      };
    });

  return { ok: true, rows: sorted };
}
