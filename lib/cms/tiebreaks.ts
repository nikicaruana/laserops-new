/**
 * lib/cms/tiebreaks.ts
 * --------------------------------------------------------------------
 * Named tie-break computations for season challenges.
 *
 * Each tie-break is a function that takes a row's already-aggregated
 * metric data and returns a numeric score. Higher score wins. (For
 * "lower is better" tie-breaks, return the negative of the natural
 * value.)
 *
 * The CMS Challenges tab references these by name (e.g.
 * "round_win_rate_descending"). When season-challenges.ts encounters
 * a tied set of rows, it applies the named tie-break to each row and
 * sorts by descending score.
 *
 * Adding a new tie-break = add a row to the TIEBREAK_REGISTRY map.
 * No code changes elsewhere needed.
 *
 * Each computation receives a "tie-break input" object that has the
 * common metrics available across all source modes. If a particular
 * tie-break needs a metric that isn't present (e.g. round_win_rate
 * applied to a match_top challenge that doesn't track wins/losses),
 * the function should return 0 — the engine treats 0 as no preference
 * and falls through to the next tie-break or the source order.
 */

/**
 * Normalised numeric data available for tie-breaking. The engine
 * populates this from the source rows after applying the challenge's
 * primary metric/aggregation.
 *
 * Fields are nullable — challenges that don't aggregate per-player
 * (e.g. match_top) won't have season-wide totals; only the underlying
 * raw row's fields will be populated.
 */
export type TiebreakInput = {
  /** The primary metric value (already computed for ranking). */
  primaryMetric: number;
  /** Additional aggregated season-wide metrics, if available. */
  seasonRoundsWon?: number;
  seasonRoundsLost?: number;
  seasonMatchesWon?: number;
  seasonMatchesPlayed?: number;
  seasonKills?: number;
  seasonDeaths?: number;
  seasonScore?: number;
  /** Match-level fields, populated only for match_top challenges. */
  matchKills?: number;
  matchDeaths?: number;
};

export type TiebreakFunction = (input: TiebreakInput) => number;

/**
 * Registered tie-break functions. The CMS references these by string
 * name in the Tiebreak_1 / Tiebreak_2 columns.
 */
const TIEBREAK_REGISTRY: Record<string, TiebreakFunction> = {
  /**
   * Round win rate: rounds_won / (rounds_won + rounds_lost), descending.
   * Used for the Round Wins challenge — a player who won 5/5 rounds
   * beats a player who won 5/10.
   */
  round_win_rate_descending: ({ seasonRoundsWon, seasonRoundsLost }) => {
    const won = seasonRoundsWon ?? 0;
    const lost = seasonRoundsLost ?? 0;
    const total = won + lost;
    if (total === 0) return 0;
    return won / total;
  },

  /**
   * Kill/death ratio for a single match. Used by the Killing Machines
   * challenge to break ties on PlayerFragsCount — among matches with
   * the same kill count, the one with the higher KD wins.
   */
  kd_ratio_descending: ({ matchKills, matchDeaths }) => {
    const kills = matchKills ?? 0;
    const deaths = matchDeaths ?? 0;
    if (deaths === 0) return kills * 1000; // unbeatable — never died
    return kills / deaths;
  },

  /**
   * Total matches won across the season, descending.
   */
  matches_won_descending: ({ seasonMatchesWon }) => seasonMatchesWon ?? 0,

  /**
   * Total points / score across the season, descending.
   */
  total_points_descending: ({ seasonScore }) => seasonScore ?? 0,

  /**
   * Total kills across the season, descending.
   */
  kills_descending: ({ seasonKills }) => seasonKills ?? 0,
};

/**
 * Look up a tie-break function by name. Returns null for unknown names —
 * the engine treats null as "no further tie-breaking" and falls through.
 */
export function getTiebreak(name: string): TiebreakFunction | null {
  if (name === "") return null;
  return TIEBREAK_REGISTRY[name] ?? null;
}
