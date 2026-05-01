/**
 * score.ts
 * --------------------------------------------------------------------
 * Aggregator for the Score leaderboard.
 *
 * Groups by player, sums Total_Points and Matches_Played across all rows
 * in the (already filtered) window, then computes Points per Match from
 * the summed totals — NOT by averaging per-month PPM, which would
 * mis-weight months with very different match counts.
 *
 * Sort: primary by Total Score desc, tiebreak by Points per Match desc,
 * then alphabetical for stability.
 */

import { parseNumericOr } from "@/lib/sheets";
import type { PeriodRow } from "@/lib/leaderboards/period-shared";

const DISPLAY_LIMIT = 50;

export type ScoreRow = {
  rank: number;
  nickname: string;
  profilePicUrl: string;
  totalScore: number;
  pointsPerMatch: number;
};

export function aggregateScore(rows: PeriodRow[]): ScoreRow[] {
  type Bucket = {
    nickname: string;
    profilePicUrl: string;
    totalPoints: number;
    matchesPlayed: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const r of rows) {
    const points = parseNumericOr(r.raw.Total_Points, 0);
    const matchesPlayed = parseNumericOr(r.raw.Matches_Played, 0);

    const existing = buckets.get(r.nickname);
    if (existing) {
      existing.totalPoints += points;
      existing.matchesPlayed += matchesPlayed;
    } else {
      buckets.set(r.nickname, {
        nickname: r.nickname,
        profilePicUrl: r.profilePicUrl,
        totalPoints: points,
        matchesPlayed,
      });
    }
  }

  // Project, drop zero-match players (they have no meaningful PPM),
  // compute PPM from totals.
  const projected: Array<Omit<ScoreRow, "rank">> = [];
  for (const b of buckets.values()) {
    if (b.matchesPlayed <= 0) continue;
    projected.push({
      nickname: b.nickname,
      profilePicUrl: b.profilePicUrl,
      totalScore: b.totalPoints,
      pointsPerMatch: b.totalPoints / b.matchesPlayed,
    });
  }

  projected.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.pointsPerMatch !== a.pointsPerMatch) return b.pointsPerMatch - a.pointsPerMatch;
    return a.nickname.localeCompare(b.nickname);
  });

  return projected.slice(0, DISPLAY_LIMIT).map((row, idx) => ({
    rank: idx + 1,
    ...row,
  }));
}
