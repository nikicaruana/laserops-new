/**
 * lib/player-stats/compare.ts
 * --------------------------------------------------------------------
 * Types, projection, and winner computation for the Compare Players page.
 *
 * Each ComparePlayerData holds everything both players' columns need:
 * identities, all comparable numeric stats, and per-accolade counts.
 * computeWinners() produces a single CompareWinners object from two
 * ComparePlayerData values — higher-is-better for every stat.
 */

import { parseNumericOr } from "@/lib/sheets";
import { FALLBACK_PROFILE_PIC, type PlayerStatsRaw } from "@/lib/player-stats/shared";
import {
  RATING_UNLOCK_MIN_MATCHES,
  RATING_UNLOCK_MIN_LEVEL,
} from "@/lib/player-stats/summary-top";
import { normalizeRateToPercent } from "@/lib/player-stats/summary-stats";
import { ACCOLADES } from "@/lib/player-stats/summary-accolades";

/* ============================================================
   Types
   ============================================================ */

export type ComparePlayerData = {
  // Identity
  nickname: string;
  profilePicUrl: string;
  overallRatingImageUrl: string;
  ratingUnlocked: boolean;
  rankBadgeUrl: string;
  levelDisplay: string;
  // Quick stats (informational + comparable)
  matchesPlayed: number;
  uniqueGunsUsed: number;
  // Wins
  matchesWon: number;
  matchWinRatePct: number;
  matchWinRatingUrl: string;
  roundsWon: number;
  roundsWinRatePct: number;
  roundsWinRatingUrl: string;
  // Per-match stats
  killsPerMatch: number;
  killsTotal: number;
  killsRatingUrl: string;
  damagePerMatch: number;
  damageTotal: number;
  damageRatingUrl: string;
  scorePerMatch: number;
  scoreTotal: number;
  scoreRatingUrl: string;
  // Single-value stats
  accuracyPct: number;
  accuracyRatingUrl: string;
  kd: number;
  kdRatingUrl: string;
  matchRating: number;
  matchRatingUrl: string;
  // Accolades
  totalAccolades: number;
  /** accolade name → count earned by this player */
  accoladesByName: Record<string, number>;
};

/** Result of comparing two players on a single stat. */
export type StatWinner = "a" | "b" | "tie";

/** Full set of per-stat winners for one head-to-head comparison. */
export type CompareWinners = {
  matchesPlayed: StatWinner;
  uniqueGuns: StatWinner;
  matchesWon: StatWinner;
  matchWinRate: StatWinner;
  roundsWon: StatWinner;
  roundsWinRate: StatWinner;
  killsPerMatch: StatWinner;
  damagePerMatch: StatWinner;
  scorePerMatch: StatWinner;
  accuracy: StatWinner;
  kd: StatWinner;
  matchRating: StatWinner;
  totalAccolades: StatWinner;
  /** per-accolade name → winner for that accolade's count */
  accolades: Record<string, StatWinner>;
};

/* ============================================================
   Helpers
   ============================================================ */

/** Higher-is-better comparison. */
function cmp(a: number, b: number): StatWinner {
  if (a > b) return "a";
  if (b > a) return "b";
  return "tie";
}

/* ============================================================
   Projection
   ============================================================ */

/**
 * Project a raw player row + pre-computed unique guns count into the
 * compare-page data shape. Defensive about missing/malformed values.
 */
export function projectComparePlayer(
  row: PlayerStatsRaw,
  uniqueGunsUsed: number,
): ComparePlayerData {
  const profileRaw = row.Player_Stats_Profile_Pic?.trim() ?? "";
  const matchesPlayed = parseNumericOr(row.Matches_Played, 0);
  const level = parseNumericOr(row.XP_Current_Level, 0);
  const ratingUnlocked =
    matchesPlayed >= RATING_UNLOCK_MIN_MATCHES &&
    level >= RATING_UNLOCK_MIN_LEVEL;

  const matchesWon = parseNumericOr(row.Matches_Won, 0);
  const matchWinRatePct = normalizeRateToPercent(row.Match_Win_Rate ?? "");

  const roundsWon = parseNumericOr(row.Rounds_Won_Total, 0);
  const roundsLost = parseNumericOr(row.Rounds_Lost_Total, 0);
  const roundsTotal = roundsWon + roundsLost;
  const roundsWinRatePct = roundsTotal > 0 ? (roundsWon / roundsTotal) * 100 : 0;

  const accoladesByName: Record<string, number> = {};
  for (const a of ACCOLADES) {
    accoladesByName[a.name] = parseNumericOr(row[a.sheetCol] ?? "", 0);
  }

  return {
    nickname: row.Player_Stats_Nickname.trim(),
    profilePicUrl: profileRaw !== "" ? profileRaw : FALLBACK_PROFILE_PIC,
    overallRatingImageUrl: row.Overall_Rating_Image?.trim() ?? "",
    ratingUnlocked,
    rankBadgeUrl: row.XP_Current_Rank_Badge_URL?.trim() ?? "",
    levelDisplay: row.XP_Current_Level_Display?.trim() ?? "",
    matchesPlayed,
    uniqueGunsUsed,
    matchesWon,
    matchWinRatePct,
    matchWinRatingUrl: row.Match_Win_Rating_image?.trim() ?? "",
    roundsWon,
    roundsWinRatePct,
    roundsWinRatingUrl: row.Rounds_WL_Rating_Image?.trim() ?? "",
    killsPerMatch: parseNumericOr(row.Kills_Per_Match, 0),
    killsTotal: parseNumericOr(row.Kills_Total, 0),
    killsRatingUrl: row.Kills_Per_Match_Rating_Image?.trim() ?? "",
    damagePerMatch: parseNumericOr(row.Damage_Per_Match, 0),
    damageTotal: parseNumericOr(row.Damage_Total, 0),
    damageRatingUrl: row.Damage_Rating_Image?.trim() ?? "",
    scorePerMatch: parseNumericOr(row.Score_Per_Match, 0),
    scoreTotal: parseNumericOr(row.Score_Total, 0),
    scoreRatingUrl: row.Score_Rating_Image?.trim() ?? "",
    accuracyPct: normalizeRateToPercent(row.Accuracy ?? ""),
    accuracyRatingUrl: row.Accuracy_Rating_Image?.trim() ?? "",
    kd: parseNumericOr(row.KD_Ratio, 0),
    kdRatingUrl: row.KD_Rating_Image?.trim() ?? "",
    matchRating: parseNumericOr(row.Match_Rating, 0),
    matchRatingUrl: row.Match_Rating_Rating_Image?.trim() ?? "",
    totalAccolades: parseNumericOr(row.Accolades_Total, 0),
    accoladesByName,
  };
}

/* ============================================================
   Winner computation
   ============================================================ */

/**
 * Compute which player wins each stat. All stats are higher-is-better.
 * Ties produce "tie" so the UI can highlight both sides equally.
 */
export function computeWinners(
  a: ComparePlayerData,
  b: ComparePlayerData,
): CompareWinners {
  const accolades: Record<string, StatWinner> = {};
  for (const def of ACCOLADES) {
    const ca = a.accoladesByName[def.name] ?? 0;
    const cb = b.accoladesByName[def.name] ?? 0;
    accolades[def.name] = cmp(ca, cb);
  }

  return {
    matchesPlayed: cmp(a.matchesPlayed, b.matchesPlayed),
    uniqueGuns: cmp(a.uniqueGunsUsed, b.uniqueGunsUsed),
    matchesWon: cmp(a.matchesWon, b.matchesWon),
    // Win rate is the rated metric — compare by rate not raw count
    matchWinRate: cmp(a.matchWinRatePct, b.matchWinRatePct),
    roundsWon: cmp(a.roundsWon, b.roundsWon),
    roundsWinRate: cmp(a.roundsWinRatePct, b.roundsWinRatePct),
    killsPerMatch: cmp(a.killsPerMatch, b.killsPerMatch),
    damagePerMatch: cmp(a.damagePerMatch, b.damagePerMatch),
    scorePerMatch: cmp(a.scorePerMatch, b.scorePerMatch),
    accuracy: cmp(a.accuracyPct, b.accuracyPct),
    kd: cmp(a.kd, b.kd),
    matchRating: cmp(a.matchRating, b.matchRating),
    totalAccolades: cmp(a.totalAccolades, b.totalAccolades),
    accolades,
  };
}
