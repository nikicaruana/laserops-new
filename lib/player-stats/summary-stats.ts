/**
 * lib/player-stats/summary-stats.ts
 * --------------------------------------------------------------------
 * Typed projection of the columns the Player Summary's STATS SECTION needs.
 *
 * Each "stat" is a card. The card has a primary number, optionally a
 * secondary line (either a stat with prefix+value, OR a free-text
 * description), and optionally a rating image.
 *
 * Per-card project functions are explicit and named rather than driven by
 * a generic config — keeps formatting decisions visible at the use site.
 *
 * Two flavours of card:
 *   - "Count + rate" cards (Match Wins, Round Wins): primary = count of
 *     wins, secondary = win rate %, rating measures the rate.
 *   - "Per-match" cards (Kills, Damage, Score): primary = per-match value
 *     (the rated metric), secondary = career total. The rating measures
 *     the per-match number, so showing it as primary keeps the rating
 *     visually next to what it's rating.
 *   - "Single value" cards (Accuracy, K/D, Avg Match Rating): primary IS
 *     the rated metric, no secondary stat. Avg Match Rating uses the
 *     "description" variant of the secondary slot to explain the metric.
 */

import { parseNumericOr } from "@/lib/sheets";
import type { PlayerStatsRaw } from "@/lib/player-stats/shared";

/**
 * Discriminated union for the card's secondary slot. Either it's a stat
 * line (prefix label + bold value) or a free-text description, not both.
 */
export type StatCardSecondary =
  | { kind: "none" }
  | { kind: "stat"; prefix: string; value: string }
  | { kind: "description"; text: string };

export type StatCard = {
  /** Label shown at the top of the card. */
  label: string;
  /** Primary value displayed prominently. Pre-formatted string. */
  primaryValue: string;
  /** Secondary content (or none). */
  secondary: StatCardSecondary;
  /** Rating image URL. Empty string if not earned yet. */
  ratingImageUrl: string;
};

/* ============================================================
   Helpers
   ============================================================ */

/**
 * Some rate columns are stored as fractions (0.75), others as percentages
 * already (75). Normalise both to 0-100. Heuristic: 0..1 → fraction → ×100.
 * Exactly 1 = 100%, the more common case for rate columns.
 */
export function normalizeRateToPercent(raw: string): number {
  const n = parseNumericOr(raw, 0);
  if (n <= 1 && n >= 0) return n * 100;
  return Math.min(100, n);
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function fmtDecimal(n: number, places = 2): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  });
}

function fmtPct(n: number): string {
  return `${Math.round(n)}%`;
}

/* ============================================================
   COUNT + RATE CARDS
   Primary = count of wins, secondary = the rate the rating measures.
   We keep these as "count primary" because the count carries useful
   calibration info (a 100% win rate from 1 match is different from a
   100% win rate from 50 matches — the count tells you which).
   ============================================================ */

export function projectMatchWinsCard(row: PlayerStatsRaw): StatCard {
  const matchesWon = parseNumericOr(row.Matches_Won, 0);
  const winRatePct = normalizeRateToPercent(row.Match_Win_Rate);
  return {
    label: "Matches Won",
    primaryValue: fmtInt(matchesWon),
    secondary: { kind: "stat", prefix: "Win Rate", value: fmtPct(winRatePct) },
    ratingImageUrl: row.Match_Win_Rating_image?.trim() ?? "",
  };
}

export function projectRoundWinsCard(row: PlayerStatsRaw): StatCard {
  const roundsWon = parseNumericOr(row.Rounds_Won_Total, 0);
  const roundsLost = parseNumericOr(row.Rounds_Lost_Total, 0);
  // Win rate computed from underlying counts. Sheet's Rounds_WL_Ratio is
  // a ratio (won/lost) not a rate (won/total) — we want the rate here so
  // it parallels Match Win Rate above.
  const total = roundsWon + roundsLost;
  const winRatePct = total > 0 ? (roundsWon / total) * 100 : 0;
  return {
    label: "Rounds Won",
    primaryValue: fmtInt(roundsWon),
    secondary: { kind: "stat", prefix: "Win Rate", value: fmtPct(winRatePct) },
    ratingImageUrl: row.Rounds_WL_Rating_Image?.trim() ?? "",
  };
}

/* ============================================================
   PER-MATCH CARDS
   Primary = per-match metric (the one the rating evaluates),
   secondary = career total. Flipped from earlier "total primary" version
   because the rating measures the per-match number — visual hierarchy
   should reflect what's being rated.
   ============================================================ */

export function projectKillsCard(row: PlayerStatsRaw): StatCard {
  const killsTotal = parseNumericOr(row.Kills_Total, 0);
  const killsPerMatch = parseNumericOr(row.Kills_Per_Match, 0);
  return {
    label: "Kills / Match",
    // 0 decimals — fractional kills don't communicate at the precision
    // players care about.
    primaryValue: fmtInt(killsPerMatch),
    secondary: { kind: "stat", prefix: "Total", value: fmtInt(killsTotal) },
    ratingImageUrl: row.Kills_Per_Match_Rating_Image?.trim() ?? "",
  };
}

export function projectDamageCard(row: PlayerStatsRaw): StatCard {
  const damageTotal = parseNumericOr(row.Damage_Total, 0);
  const damagePerMatch = parseNumericOr(row.Damage_Per_Match, 0);
  return {
    label: "Damage / Match",
    primaryValue: fmtInt(damagePerMatch),
    secondary: { kind: "stat", prefix: "Total", value: fmtInt(damageTotal) },
    ratingImageUrl: row.Damage_Rating_Image?.trim() ?? "",
  };
}

export function projectScoreCard(row: PlayerStatsRaw): StatCard {
  const scoreTotal = parseNumericOr(row.Score_Total, 0);
  const scorePerMatch = parseNumericOr(row.Score_Per_Match, 0);
  return {
    label: "Score / Match",
    primaryValue: fmtInt(scorePerMatch),
    secondary: { kind: "stat", prefix: "Total", value: fmtInt(scoreTotal) },
    ratingImageUrl: row.Score_Rating_Image?.trim() ?? "",
  };
}

/* ============================================================
   SINGLE VALUE CARDS
   The primary value IS the rated metric. No secondary stat needed.
   Avg Match Rating gets a description because the metric itself isn't
   self-explanatory ("2.15" doesn't mean anything without context).
   ============================================================ */

export function projectAccuracyCard(row: PlayerStatsRaw): StatCard {
  const accPct = normalizeRateToPercent(row.Accuracy);
  return {
    label: "Accuracy",
    // 1 decimal — accuracy values cluster in a tight band and small
    // differences (21.3% vs 21.7%) are meaningful.
    primaryValue: `${accPct.toFixed(1)}%`,
    secondary: { kind: "none" },
    ratingImageUrl: row.Accuracy_Rating_Image?.trim() ?? "",
  };
}

export function projectKdRatioCard(row: PlayerStatsRaw): StatCard {
  const kd = parseNumericOr(row.KD_Ratio, 0);
  return {
    label: "K/D Ratio",
    primaryValue: fmtDecimal(kd),
    secondary: { kind: "none" },
    ratingImageUrl: row.KD_Rating_Image?.trim() ?? "",
  };
}

export function projectMatchRatingCard(row: PlayerStatsRaw): StatCard {
  const rating = parseNumericOr(row.Match_Rating, 0);
  return {
    label: "Avg Match Rating",
    primaryValue: fmtDecimal(rating),
    // Description rather than secondary stat — Match Rating is a
    // unit-less number that's meaningless without context. The
    // description gives that context inline.
    secondary: {
      kind: "description",
      text: "Your score vs the average match score. 1.0 = average.",
    },
    ratingImageUrl: row.Match_Rating_Rating_Image?.trim() ?? "",
  };
}
