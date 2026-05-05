/**
 * lib/leaderboards/accolades.ts
 * --------------------------------------------------------------------
 * Aggregator for the Accolades leaderboard.
 *
 * Unlike the Kills/Damage/Score/Accuracy leaderboards which read from
 * the period-stats sheet (one row per player per month), this one
 * walks Game_Data_Lookup directly — accolades aren't pre-aggregated
 * per period, they're earned per match via the `Accolade_<Name>`
 * 0/1 columns.
 *
 * For each player-match row:
 *   1. Iterate every known Accolade_<Name> column
 *   2. If the value is truthy ("1" / "TRUE" / etc.), the accolade
 *      was earned in that match.
 *   3. Look up the accolade in the CMS to get its XP value.
 *   4. Derive the tier from XP:
 *        100 XP → Tier 1
 *         75 XP → Tier 2
 *         50 XP → Tier 3
 *      Anything else → unrated, doesn't increment any tier counter
 *      but DOES increment the total. This is defensive — if a new
 *      accolade is added with an unmapped XP value, it still counts
 *      toward the player's total but doesn't pollute a wrong tier.
 *
 * Sort: primary by Total Accolades desc, then T1 desc (most-prestigious
 * tier as tiebreaker), then T2, then T3, then alphabetical.
 *
 * Period filtering: callers can pass a year/month filter and we'll
 * only count rows whose yearMonth matches. Mirrors how the period
 * leaderboards filter.
 */

import { ACCOLADE_COLUMN_SUFFIXES } from "@/lib/match-report/engine";
import { accoladeKey, type Accolade } from "@/lib/cms/accolades";
import type { GameDataRow } from "@/lib/game-data/lookup";
import { FALLBACK_PROFILE_PIC } from "@/lib/leaderboards/period-shared";

const DISPLAY_LIMIT = 50;

/**
 * Tier-from-XP mapping. Niki defined:
 *   - Tier 1 = 100 XP (most prestigious)
 *   - Tier 2 = 75 XP
 *   - Tier 3 = 50 XP
 * Other XP values aren't mapped to a tier and are treated as
 * "unrated" — they still count toward the player's total
 * accolades but don't increment any tier-specific counter. This
 * makes the leaderboard tolerant of CMS edits where a new
 * accolade gets a non-standard XP value before its tier is
 * formally decided.
 */
function deriveTier(xp: number): 1 | 2 | 3 | null {
  if (xp === 100) return 1;
  if (xp === 75) return 2;
  if (xp === 50) return 3;
  return null;
}

export type AccoladesRow = {
  rank: number;
  nickname: string;
  profilePicUrl: string;
  tier1: number;
  tier2: number;
  tier3: number;
  total: number;
};

/**
 * Optional period filter. Both fields independent — pass year
 * alone to filter to a year, year+month to a specific month, or
 * nothing to include all rows.
 */
export type AccoladesPeriodFilter = {
  year?: number;
  monthNum?: number;
};

/**
 * Run the aggregation.
 *
 * @param gameRows  All player-match rows from fetchGameDataRows().
 * @param accolades CMS metadata for every accolade — used to map
 *                  each earned-accolade column to its XP and tier.
 * @param filter    Optional period filter (year, monthNum).
 */
export function aggregateAccolades(
  gameRows: GameDataRow[],
  accolades: Accolade[],
  filter: AccoladesPeriodFilter = {},
): AccoladesRow[] {
  // Build a key → accolade lookup so the per-row scan is O(1) per
  // accolade column instead of O(accolades).
  const accByKey = new Map<string, Accolade>();
  for (const a of accolades) accByKey.set(a.key, a);

  type Bucket = {
    nickname: string;
    profilePicUrl: string;
    tier1: number;
    tier2: number;
    tier3: number;
    total: number;
  };
  const buckets = new Map<string, Bucket>();

  // Apply the period filter as we iterate. Game data rows have a
  // normalised yearMonth ("YYYY-MM") and the row's date components
  // can be derived from it.
  for (const row of gameRows) {
    if (!matchesPeriodFilter(row.yearMonth, filter)) continue;

    // Lazy-init the bucket for this player on first sighting.
    let entry = buckets.get(row.nickname);
    if (entry === undefined) {
      entry = {
        nickname: row.nickname,
        // Game data row already has a profilePicUrl with fallback
        // applied (see lib/game-data/lookup.ts), so we use it as-is.
        profilePicUrl: row.profilePicUrl || FALLBACK_PROFILE_PIC,
        tier1: 0,
        tier2: 0,
        tier3: 0,
        total: 0,
      };
      buckets.set(row.nickname, entry);
    }

    // Scan every known accolade column on this row. The match-report
    // engine maintains the canonical list — we import it so a new
    // accolade only needs adding in one place.
    for (const suffix of ACCOLADE_COLUMN_SUFFIXES) {
      const value = row.raw[`Accolade_${suffix}`];
      if (!parseFlexBool(value)) continue;

      // Earned. Total always increments; tier depends on the
      // CMS-derived XP value.
      entry.total += 1;
      const accolade = accByKey.get(accoladeKey(suffix));
      if (accolade) {
        const tier = deriveTier(accolade.xp);
        if (tier === 1) entry.tier1 += 1;
        else if (tier === 2) entry.tier2 += 1;
        else if (tier === 3) entry.tier3 += 1;
        // tier === null: unrated XP value, still counted in total
        // (above) but no tier-specific increment.
      }
      // accolade missing from CMS: counted in total but no tier
      // increment — same effect as unrated XP. Defensive: prevents
      // a CMS-row deletion from silently dropping the player's
      // achievements from the leaderboard.
    }
  }

  // Drop players with zero accolades — they shouldn't rank.
  const projected: Array<Omit<AccoladesRow, "rank">> = [];
  for (const b of buckets.values()) {
    if (b.total <= 0) continue;
    projected.push({
      nickname: b.nickname,
      profilePicUrl: b.profilePicUrl,
      tier1: b.tier1,
      tier2: b.tier2,
      tier3: b.tier3,
      total: b.total,
    });
  }

  projected.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    // Tiebreak by tier prestige: more T1s win, then T2s, then T3s.
    if (b.tier1 !== a.tier1) return b.tier1 - a.tier1;
    if (b.tier2 !== a.tier2) return b.tier2 - a.tier2;
    if (b.tier3 !== a.tier3) return b.tier3 - a.tier3;
    return a.nickname.localeCompare(b.nickname);
  });

  return projected.slice(0, DISPLAY_LIMIT).map((row, idx) => ({
    rank: idx + 1,
    ...row,
  }));
}

/**
 * Return true if the row's yearMonth matches the (optional) filter.
 * Empty filter = include everything. Year only = include all months
 * in that year. Year + monthNum = exact month match.
 *
 * Defensive against rows with malformed yearMonth (empty string from
 * the parser when the source data was unparseable). Such rows fail
 * any positive filter and pass when no filter is set — same behaviour
 * as the period-shared filter.
 */
function matchesPeriodFilter(
  yearMonth: string,
  filter: AccoladesPeriodFilter,
): boolean {
  if (filter.year === undefined && filter.monthNum === undefined) return true;
  if (yearMonth === "") return false;
  // yearMonth format is "YYYY-MM" — normalised by the game-data
  // fetcher.
  const [yStr, mStr] = yearMonth.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return false;
  if (filter.year !== undefined && y !== filter.year) return false;
  if (filter.monthNum !== undefined && m !== filter.monthNum) return false;
  return true;
}

/**
 * Parse a "flexible" boolean from a sheet cell value. Same logic as
 * the match-report engine — accepts "1"/"true"/"yes"/"y" as truthy,
 * everything else as false. Inlined here rather than imported because
 * exporting it from the engine isn't strictly necessary and keeps the
 * shared surface area small.
 */
function parseFlexBool(value: string | undefined): boolean {
  const v = (value ?? "").trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "y";
}
