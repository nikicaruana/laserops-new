/**
 * lib/leaderboards/damage.ts
 * --------------------------------------------------------------------
 * Aggregator for the Damage leaderboard.
 *
 * Groups by player. Sums Total_Damage and Rounds_Played across the
 * (already-filtered) period window, then derives Damage/Round from the
 * sums (not by averaging per-month damage/round – same weighting concern
 * as the Score and Kills aggregators).
 *
 * Sort: primary by Total Damage desc, tiebreak by Damage/Round desc,
 * then alphabetical for stability.
 */

import { parseNumericOr } from "@/lib/sheets";
import type { PeriodRow } from "@/lib/leaderboards/period-shared";

const DISPLAY_LIMIT = 50;

export type DamageRow = {
  rank: number;
  nickname: string;
  profilePicUrl: string;
  totalDamage: number;
  damagePerRound: number;
};

export function aggregateDamage(rows: PeriodRow[]): DamageRow[] {
  type Bucket = {
    nickname: string;
    profilePicUrl: string;
    damage: number;
    rounds: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const r of rows) {
    const damage = parseNumericOr(r.raw.Total_Damage, 0);
    const rounds = parseNumericOr(r.raw.Rounds_Played, 0);

    const existing = buckets.get(r.nickname);
    if (existing) {
      existing.damage += damage;
      existing.rounds += rounds;
    } else {
      buckets.set(r.nickname, {
        nickname: r.nickname,
        profilePicUrl: r.profilePicUrl,
        damage,
        rounds,
      });
    }
  }

  const projected: Array<Omit<DamageRow, "rank">> = [];
  for (const b of buckets.values()) {
    if (b.rounds <= 0) continue;
    projected.push({
      nickname: b.nickname,
      profilePicUrl: b.profilePicUrl,
      totalDamage: b.damage,
      damagePerRound: b.damage / b.rounds,
    });
  }

  projected.sort((a, b) => {
    if (b.totalDamage !== a.totalDamage) return b.totalDamage - a.totalDamage;
    if (b.damagePerRound !== a.damagePerRound)
      return b.damagePerRound - a.damagePerRound;
    return a.nickname.localeCompare(b.nickname);
  });

  return projected.slice(0, DISPLAY_LIMIT).map((row, idx) => ({
    rank: idx + 1,
    ...row,
  }));
}
