/**
 * lib/leaderboards/kills.ts
 * --------------------------------------------------------------------
 * Aggregator for the Kills leaderboard.
 *
 * Groups by player. Sums Kills_Total, Deaths_Total, and Matches_Played
 * across the (already-filtered) period window, then derives Kills/Match
 * and K/D from the SUMS — never by averaging per-month per-row values.
 *
 * Why: averaging a player's per-month K/D weighs each month equally
 * regardless of how many matches the player played that month. A
 * player with 1 lucky game (10 kills, 0 deaths) in March and 30
 * normal games in April would get an unrealistically inflated K/D.
 * Summing first then dividing fixes that.
 *
 * Sort: primary by Total Kills desc, tiebreak by Kills/Match desc, then
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
  killsPerMatch: number;
  /** kills / max(deaths, 1) — clamping deaths to 1 avoids infinity for
   *  zero-death sets while staying realistic. Same approach used in
   *  the weapons usage-stats aggregator and elsewhere. */
  kdRatio: number;
};

export function aggregateKills(rows: PeriodRow[]): KillsRow[] {
  type Bucket = {
    nickname: string;
    profilePicUrl: string;
    kills: number;
    deaths: number;
    matchesPlayed: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const r of rows) {
    const kills = parseNumericOr(r.raw.Total_Kills, 0);
    const deaths = parseNumericOr(r.raw.Total_Deaths, 0);
    const matchesPlayed = parseNumericOr(r.raw.Matches_Played, 0);

    const existing = buckets.get(r.nickname);
    if (existing) {
      existing.kills += kills;
      existing.deaths += deaths;
      existing.matchesPlayed += matchesPlayed;
    } else {
      buckets.set(r.nickname, {
        nickname: r.nickname,
        profilePicUrl: r.profilePicUrl,
        kills,
        deaths,
        matchesPlayed,
      });
    }
  }

  // Drop zero-match players — kills/match is undefined for them and
  // they shouldn't appear ranked.
  const projected: Array<Omit<KillsRow, "rank">> = [];
  for (const b of buckets.values()) {
    if (b.matchesPlayed <= 0) continue;
    projected.push({
      nickname: b.nickname,
      profilePicUrl: b.profilePicUrl,
      totalKills: b.kills,
      killsPerMatch: b.kills / b.matchesPlayed,
      kdRatio: b.kills / Math.max(b.deaths, 1),
    });
  }

  projected.sort((a, b) => {
    if (b.totalKills !== a.totalKills) return b.totalKills - a.totalKills;
    if (b.killsPerMatch !== a.killsPerMatch)
      return b.killsPerMatch - a.killsPerMatch;
    if (b.kdRatio !== a.kdRatio) return b.kdRatio - a.kdRatio;
    return a.nickname.localeCompare(b.nickname);
  });

  return projected.slice(0, DISPLAY_LIMIT).map((row, idx) => ({
    rank: idx + 1,
    ...row,
  }));
}
