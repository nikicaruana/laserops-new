/**
 * match-round-wins.ts
 * --------------------------------------------------------------------
 * Aggregator for the Match / Round Wins leaderboard.
 *
 * Reads PeriodRows (one row per player per month), groups by player,
 * sums Matches_Won and Rounds_Won/Lost across all rows in scope, and
 * computes the Round Win Rate from the summed totals (NOT from averaging
 * per-month rates — that would weight a 1-round month equally with a
 * 100-round month, which is statistically wrong).
 *
 * Sort: primary by Matches_Won desc, tiebreak by Rounds_Won desc, then
 * by Round Win Rate desc, then alphabetical for stability.
 *
 * The aggregator is pure: caller hands in already-filtered PeriodRows,
 * and we group/sum/sort/cap. The filter step belongs upstream so the
 * same aggregator works for any Year/Month combination.
 */

import { parseNumericOr } from "@/lib/sheets";
import type { PeriodRow } from "@/lib/leaderboards/period-shared";

/** Cap displayed players. Matches the XP/Levels behaviour. */
const DISPLAY_LIMIT = 50;

/**
 * Final shape consumed by the table. All numerics parsed; rank derived
 * from sort position; winRate is a 0-100 number (display formats with %).
 *
 * winRate is `null` when the player has no rounds played in the filter
 * window — display as "—" rather than "0%" or "NaN%".
 */
export type MatchRoundWinsRow = {
  rank: number;
  nickname: string;
  profilePicUrl: string;
  matchWins: number;
  roundWins: number;
  roundWinRate: number | null;
};

/**
 * Aggregate filtered PeriodRows into a sorted, capped MatchRoundWinsRow list.
 *
 * Steps:
 *   1. Group rows by nickname
 *   2. Sum the relevant stat columns within each group
 *   3. Compute win rate from summed totals
 *   4. Drop players with zero matches in the window (they wouldn't appear
 *      meaningfully in a "Match Wins" leaderboard)
 *   5. Sort by primary metric, then tiebreaks
 *   6. Slice to top N and assign ranks
 */
export function aggregateMatchRoundWins(rows: PeriodRow[]): MatchRoundWinsRow[] {
  // Group + sum
  type Bucket = {
    nickname: string;
    profilePicUrl: string;
    matchesPlayed: number; // for the "any matches in window?" filter below
    matchWins: number;
    roundWins: number;
    roundLosses: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const r of rows) {
    const matchesPlayed = parseNumericOr(r.raw.Matches_Played, 0);
    const matchesWon = parseNumericOr(r.raw.Matches_Won, 0);
    const roundsWon = parseNumericOr(r.raw.Rounds_Won, 0);
    const roundsLost = parseNumericOr(r.raw.Rounds_Lost, 0);

    const existing = buckets.get(r.nickname);
    if (existing) {
      existing.matchesPlayed += matchesPlayed;
      existing.matchWins += matchesWon;
      existing.roundWins += roundsWon;
      existing.roundLosses += roundsLost;
      // Keep the first non-fallback profile pic we saw — they should all
      // match across a player's rows but be defensive.
    } else {
      buckets.set(r.nickname, {
        nickname: r.nickname,
        profilePicUrl: r.profilePicUrl,
        matchesPlayed,
        matchWins: matchesWon,
        roundWins: roundsWon,
        roundLosses: roundsLost,
      });
    }
  }

  // Project to display rows, drop zero-matches players, compute win rate
  const projected: Array<Omit<MatchRoundWinsRow, "rank">> = [];
  for (const b of buckets.values()) {
    if (b.matchesPlayed <= 0) continue; // not really in this window
    const totalRounds = b.roundWins + b.roundLosses;
    const winRate =
      totalRounds > 0 ? (b.roundWins / totalRounds) * 100 : null;
    projected.push({
      nickname: b.nickname,
      profilePicUrl: b.profilePicUrl,
      matchWins: b.matchWins,
      roundWins: b.roundWins,
      roundWinRate: winRate,
    });
  }

  // Sort: matchWins desc, then roundWins desc, then winRate desc (nulls last),
  // then alphabetical for deterministic order with no other signal.
  projected.sort((a, b) => {
    if (b.matchWins !== a.matchWins) return b.matchWins - a.matchWins;
    if (b.roundWins !== a.roundWins) return b.roundWins - a.roundWins;
    const ar = a.roundWinRate;
    const br = b.roundWinRate;
    if (ar === null && br !== null) return 1;
    if (br === null && ar !== null) return -1;
    if (ar !== null && br !== null && ar !== br) return br - ar;
    return a.nickname.localeCompare(b.nickname);
  });

  return projected.slice(0, DISPLAY_LIMIT).map((row, idx) => ({
    rank: idx + 1,
    ...row,
  }));
}
