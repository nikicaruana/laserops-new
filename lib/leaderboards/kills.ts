/**
 * lib/leaderboards/kills.ts
 * --------------------------------------------------------------------
 * Aggregator for the Kills leaderboard.
 *
 * Groups by player. Sums Total_Kills, Total_Deaths, and Rounds_Played
 * across the (already-filtered) period window, then derives Kills/Round
 * and K/D from the SUMS – never by averaging per-month per-row values.
 *
 * Why: averaging a player's per-month K/D weighs each month equally
 * regardless of how many rounds the player played that month. Summing
 * first then dividing fixes that.
 *
 * Sort: primary by Total Kills desc, tiebreak by Kills/Round desc, then
 * K/D desc, then alphabetical for stability.
 */

import { parseNumericOr } from "@/lib/sheets";
import type { PeriodRow } from "@/lib/leaderboards/period-shared";

const DISPLAY_LIMIT = 50;

export type KillsRow = {
  rank: number;
  nickname: string;
  profilePicUrl: string;
  totalKills: number;
  killsPerRound: number;
  /** kills / max(deaths, 1) – clamping deaths to 1 avoids infinity for
   *  zero-death sets while staying realistic. */
  kdRatio: number;
};

export function aggregateKills(rows: PeriodRow[]): KillsRow[] {
  type Bucket = {
    nickname: string;
    profilePicUrl: string;
    kills: number;
    deaths: number;
    rounds: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const r of rows) {
    const kills = parseNumericOr(r.raw.Total_Kills, 0);
    const deaths = parseNumericOr(r.raw.Total_Deaths, 0);
    const rounds = parseNumericOr(r.raw.Rounds_Played, 0);

    const existing = buckets.get(r.nickname);
    if (existing) {
      existing.kills += kills;
      existing.deaths += deaths;
      existing.rounds += rounds;
    } else {
      buckets.set(r.nickname, {
        nickname: r.nickname,
        profilePicUrl: r.profilePicUrl,
        kills,
        deaths,
        rounds,
      });
    }
  }

  // Drop zero-round players – kills/round is undefined for them and
  // they shouldn't appear ranked.
  const projected: Array<Omit<KillsRow, "rank">> = [];
  for (const b of buckets.values()) {
    if (b.rounds <= 0) continue;
    projected.push({
      nickname: b.nickname,
      profilePicUrl: b.profilePicUrl,
      totalKills: b.kills,
      killsPerRound: b.kills / b.rounds,
      kdRatio: b.kills / Math.max(b.deaths, 1),
    });
  }

  projected.sort((a, b) => {
    if (b.totalKills !== a.totalKills) return b.totalKills - a.totalKills;
    if (b.killsPerRound !== a.killsPerRound)
      return b.killsPerRound - a.killsPerRound;
    if (b.kdRatio !== a.kdRatio) return b.kdRatio - a.kdRatio;
    return a.nickname.localeCompare(b.nickname);
  });

  return projected.slice(0, DISPLAY_LIMIT).map((row, idx) => ({
    rank: idx + 1,
    ...row,
  }));
}
