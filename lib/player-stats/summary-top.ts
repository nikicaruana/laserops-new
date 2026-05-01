/**
 * lib/player-stats/summary-top.ts
 * --------------------------------------------------------------------
 * Typed projection of the columns the Player Summary's TOP SECTION needs.
 * Stats and Accolades sections will get their own projections later.
 *
 * Keeping projections small and focused makes each consuming component
 * obvious about what it depends on, and makes mocking / testing easier.
 */

import { parseNumericOr } from "@/lib/sheets";
import {
  FALLBACK_PROFILE_PIC,
  type PlayerStatsRaw,
} from "@/lib/player-stats/shared";

/**
 * Everything the top section of the player summary needs.
 * Parsed numerics, fallback URLs already applied.
 */
export type SummaryTop = {
  nickname: string;
  profilePicUrl: string;
  /** URL to the 5-star Overall_Rating image. May be empty if rating not yet earned. */
  overallRatingImageUrl: string;
  /** URL to the rank/level badge. */
  rankBadgeUrl: string;
  /** Display string for level, e.g. "Level 8". */
  levelDisplay: string;
  /** Total matches played. */
  matchesPlayed: number;
  /** Lifetime XP. */
  totalXp: number;
  /** Progress within the current level, as 0-100 percentage. Clamped. */
  levelProgressPct: number;
  /** Favourite gun name, e.g. "AK-25 Predator". May be empty. */
  favouriteGun: string;
  /** Image URL for the favourite gun. May be empty. */
  favouriteGunImageUrl: string;
};

/**
 * Project a raw row into the top-section shape. Defensive about missing or
 * malformed values — every consumer should be able to render even if a
 * specific column is empty or junk.
 */
export function projectSummaryTop(row: PlayerStatsRaw): SummaryTop {
  const profileRaw = row.Player_Stats_Profile_Pic?.trim() ?? "";
  // The source stores XP_Level_Progress_Pct as a fraction (0.0 to 1.0),
  // so multiply by 100 to get a percentage. Clamp to [0, 100] defensively
  // in case the source produces a value > 1 (rounding error, etc.) or < 0
  // (negative residual edge cases).
  const rawFraction = parseNumericOr(row.XP_Level_Progress_Pct, 0);
  const levelProgressPct = Math.max(0, Math.min(100, rawFraction * 100));

  return {
    nickname: row.Player_Stats_Nickname.trim(),
    profilePicUrl: profileRaw !== "" ? profileRaw : FALLBACK_PROFILE_PIC,
    overallRatingImageUrl: row.Overall_Rating_Image?.trim() ?? "",
    rankBadgeUrl: row.XP_Current_Rank_Badge_URL?.trim() ?? "",
    levelDisplay: row.XP_Current_Level_Display?.trim() ?? "",
    matchesPlayed: parseNumericOr(row.Matches_Played, 0),
    totalXp: parseNumericOr(row.XP_Total, 0),
    levelProgressPct,
    favouriteGun: row.Favourite_Gun?.trim() ?? "",
    favouriteGunImageUrl: row.Favourite_Gun_Image?.trim() ?? "",
  };
}
