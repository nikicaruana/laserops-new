/**
 * score.ts
 * --------------------------------------------------------------------
 * Aggregator for the Score leaderboard.
 *
 * Groups by player, sums Total_Points and Rounds_Played across all rows
 * in the (already filtered) window, then computes Points per Round from
 * the summed totals – NOT by averaging per-month PPR, which would
 * mis-weight months with very different round counts.
 *
 * Sort: primary by Total Score desc, tiebreak by Points per Round desc,
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
  pointsPerRound: number;
};

export function aggregateScore(rows: PeriodRow[]): ScoreRow[] {
  type Bucket = {
    nickname: string;
    profilePicUrl: string;
    totalPoints: number;
    rounds: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const r of rows) {
    const points = parseNumericOr(r.raw.Total_Points, 0);
    const rounds = parseNumericOr(r.raw.Rounds_Played, 0);

    const existing = buckets.get(r.nickname);
    if (existing) {
      existing.totalPoints += points;
      existing.rounds += rounds;
    } else {
      buckets.set(r.nickname, {
        nickname: r.nickname,
        profilePicUrl: r.profilePicUrl,
        totalPoints: points,
        rounds,
      });
    }
  }

  // Project, drop zero-round players (they have no meaningful PPR),
  // compute PPR from totals.
  const projected: Array<Omit<ScoreRow, "rank">> = [];
  for (const b of buckets.values()) {
    if (b.rounds <= 0) continue;
    projected.push({
      nickname: b.nickname,
      profilePicUrl: b.profilePicUrl,
      totalScore: b.totalPoints,
      pointsPerRound: b.totalPoints / b.rounds,
    });
  }

  projected.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.pointsPerRound !== a.pointsPerRound) return b.pointsPerRound - a.pointsPerRound;
    return a.nickname.localeCompare(b.nickname);
  });

  return projected.slice(0, DISPLAY_LIMIT).map((row, idx) => ({
    rank: idx + 1,
    ...row,
  }));
}
