/**
 * lib/leaderboards/damage.ts
 * --------------------------------------------------------------------
 * Aggregator for the Damage leaderboard.
 *
 * Groups by player. Sums Damage_Total and Matches_Played across the
 * (already-filtered) period window, then derives Damage/Match from
 * the sums (not by averaging per-month damage/match — same weighting
 * concern as the Score and Kills aggregators).
 *
 * Sort: primary by Total Damage desc, tiebreak by Damage/Match desc,
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
  damagePerMatch: number;
};

export function aggregateDamage(rows: PeriodRow[]): DamageRow[] {
  type Bucket = {
    nickname: string;
    profilePicUrl: string;
    damage: number;
    matchesPlayed: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const r of rows) {
    // Damage_Total is the canonical column name on the period sheet.
    const damage = parseNumericOr(r.raw.Damage_Total, 0);
    const matchesPlayed = parseNumericOr(r.raw.Matches_Played, 0);

    const existing = buckets.get(r.nickname);
    if (existing) {
      existing.damage += damage;
      existing.matchesPlayed += matchesPlayed;
    } else {
      buckets.set(r.nickname, {
        nickname: r.nickname,
        profilePicUrl: r.profilePicUrl,
        damage,
        matchesPlayed,
      });
    }
  }

  const projected: Array<Omit<DamageRow, "rank">> = [];
  for (const b of buckets.values()) {
    if (b.matchesPlayed <= 0) continue;
    projected.push({
      nickname: b.nickname,
      profilePicUrl: b.profilePicUrl,
      totalDamage: b.damage,
      damagePerMatch: b.damage / b.matchesPlayed,
    });
  }

  projected.sort((a, b) => {
    if (b.totalDamage !== a.totalDamage) return b.totalDamage - a.totalDamage;
    if (b.damagePerMatch !== a.damagePerMatch)
      return b.damagePerMatch - a.damagePerMatch;
    return a.nickname.localeCompare(b.nickname);
  });

  return projected.slice(0, DISPLAY_LIMIT).map((row, idx) => ({
    rank: idx + 1,
    ...row,
  }));
}
