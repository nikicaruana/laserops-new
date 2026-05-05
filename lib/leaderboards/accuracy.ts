/**
 * lib/leaderboards/accuracy.ts
 * --------------------------------------------------------------------
 * Aggregator for the Accuracy leaderboard.
 *
 * Groups by player. Sums Hits_Total and Shots_Total across the
 * (already-filtered) period window, then computes accuracy as
 * `hits / shots` from the sums.
 *
 * Why sums-then-divide (not averaging per-month accuracies):
 * accuracy is a ratio. Averaging the ratios would weight a 5-shot
 * month equally to a 500-shot month — inflating or deflating the
 * "real" accuracy depending on which months were lighter. Summing
 * hits and shots first and dividing once gives the player's true
 * career accuracy across the window.
 *
 * Sort: primary by Accuracy desc, tiebreak by Total Shots desc
 * (more volume → more confidence in the rate), then alphabetical.
 *
 * Players with zero shots in the window are excluded — accuracy is
 * undefined and they shouldn't rank. There's no minimum-shots
 * threshold by default; if noise from very-low-volume players
 * (e.g. 1 hit / 1 shot = 100%) becomes a problem, set MIN_SHOTS
 * below to a non-zero value to filter them out. Kept at 0 for now
 * to match the rest-of-site convention of "show all qualifying
 * players, let the user judge."
 */

import { parseNumericOr } from "@/lib/sheets";
import type { PeriodRow } from "@/lib/leaderboards/period-shared";

const DISPLAY_LIMIT = 50;

/**
 * Minimum total shots in the window for a player to qualify. Set to
 * 0 to disable the filter (show everyone). Recommended values when
 * the data grows: 100 for monthly windows, 500 for season-long, 1000
 * for all-time. For now we trust the data and let small-sample
 * players appear.
 */
const MIN_SHOTS = 0;

export type AccuracyRow = {
  rank: number;
  nickname: string;
  profilePicUrl: string;
  /** Accuracy as a 0..1 fraction (NOT a percentage). Convert to %
   *  at render time. */
  accuracy: number;
  totalShots: number;
};

export function aggregateAccuracy(rows: PeriodRow[]): AccuracyRow[] {
  type Bucket = {
    nickname: string;
    profilePicUrl: string;
    hits: number;
    shots: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const r of rows) {
    const hits = parseNumericOr(r.raw.Hits_Total, 0);
    const shots = parseNumericOr(r.raw.Shots_Total, 0);

    const existing = buckets.get(r.nickname);
    if (existing) {
      existing.hits += hits;
      existing.shots += shots;
    } else {
      buckets.set(r.nickname, {
        nickname: r.nickname,
        profilePicUrl: r.profilePicUrl,
        hits,
        shots,
      });
    }
  }

  const projected: Array<Omit<AccuracyRow, "rank">> = [];
  for (const b of buckets.values()) {
    if (b.shots <= 0) continue; // accuracy undefined
    if (b.shots < MIN_SHOTS) continue; // noise floor
    projected.push({
      nickname: b.nickname,
      profilePicUrl: b.profilePicUrl,
      accuracy: b.hits / b.shots,
      totalShots: b.shots,
    });
  }

  projected.sort((a, b) => {
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    // Tiebreak: more total shots → more reliable rate.
    if (b.totalShots !== a.totalShots) return b.totalShots - a.totalShots;
    return a.nickname.localeCompare(b.nickname);
  });

  return projected.slice(0, DISPLAY_LIMIT).map((row, idx) => ({
    rank: idx + 1,
    ...row,
  }));
}
