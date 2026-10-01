/**
 * lib/scoring/xp.ts
 * --------------------------------------------------------------------
 * The single source of truth for per-match XP under the v2 relative-performance
 * model. Used both at ingest (commit.ts) and by the admin recompute
 * (progression.ts), so changing xp_config recomputes the whole playerbase from
 * stored aggregate inputs without re-ingesting rounds.
 *
 *   xp_points     = round((base + pool * min(rating, cap)) * multiplier)
 *   xp_wins       = round((roundWin * roundsWon + matchWin * win) * multiplier)
 *   xp_accolades  = round(accoladeXp * multiplier)    // boosted like points/wins
 *   xp_total      = points + wins + accolades
 *
 * `rating` = the player's score / the match's average score (lobby-relative), so
 * it is fair across online and offline games; the pool * rating term replaces the
 * old raw-score term. The token/double-XP multiplier boosts points, wins AND accolades.
 */
export type XpConfig = { base: number; roundWin: number; matchWin: number; perfPool: number; ratingCap: number };

export const DEFAULT_XP_CONFIG: XpConfig = { base: 250, roundWin: 750, matchWin: 500, perfPool: 3000, ratingCap: 4 };

/** Keys as stored in the xp_config table (key/value rows). */
export const XP_CONFIG_KEYS = {
  base: "Base_XP",
  roundWin: "Round_Win_XP",
  matchWin: "Match_Win_XP",
  perfPool: "Performance_Pool",
  ratingCap: "Rating_Cap",
} as const;

export function parseXpConfig(rows: { key: string; value: number | string | null }[]): XpConfig {
  const m = new Map(rows.map((r) => [r.key, r.value == null ? null : Number(r.value)]));
  const g = (key: string, d: number) => { const v = m.get(key); return v == null || Number.isNaN(v) ? d : v; };
  return {
    base: g(XP_CONFIG_KEYS.base, DEFAULT_XP_CONFIG.base),
    roundWin: g(XP_CONFIG_KEYS.roundWin, DEFAULT_XP_CONFIG.roundWin),
    matchWin: g(XP_CONFIG_KEYS.matchWin, DEFAULT_XP_CONFIG.matchWin),
    perfPool: g(XP_CONFIG_KEYS.perfPool, DEFAULT_XP_CONFIG.perfPool),
    ratingCap: g(XP_CONFIG_KEYS.ratingCap, DEFAULT_XP_CONFIG.ratingCap),
  };
}

export type XpInputs = {
  rating: number;          // score / match_average_score (0 if unknown)
  roundsWon: number;
  isWinner: boolean;
  accoladeXp: number;      // summed accolade XP (base, un-multiplied)
  multiplier?: number;     // per-player XP-boost token (1 / 1.5 / 2); default 1
};

export type XpBreakdown = { xpFromPoints: number; xpFromWins: number; xpFromAccolades: number; xpTotal: number };

export function computeMatchXp(inp: XpInputs, cfg: XpConfig): XpBreakdown {
  const mult = inp.multiplier && inp.multiplier > 0 ? inp.multiplier : 1;
  const rating = Math.max(inp.rating || 0, 0);
  const perf = cfg.perfPool * Math.min(rating, cfg.ratingCap);
  const xpFromPoints = Math.round((cfg.base + perf) * mult);
  const xpFromWins = Math.round((cfg.roundWin * (inp.roundsWon || 0) + (inp.isWinner ? cfg.matchWin : 0)) * mult);
  const xpFromAccolades = Math.round((inp.accoladeXp || 0) * mult);
  return { xpFromPoints, xpFromWins, xpFromAccolades, xpTotal: xpFromPoints + xpFromWins + xpFromAccolades };
}
