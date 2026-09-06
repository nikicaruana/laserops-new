/**
 * lib/scoring/elo.ts
 * --------------------------------------------------------------------
 * Team-based Elo with a personal-performance modifier, driven entirely by the
 * elo_config table. One match's rating change for a player is:
 *
 *   teamMult  = clamp(baseline / size, Team_K_Min, Team_K_Max)      // small matches swing more
 *   perfMult  = clamp(size / baseline, Perf_Min, Perf_Max)          // big matches reward form more
 *   E         = 1 / (1 + 10^((oppAvgElo - teamAvgElo) / Divisor))   // expected team result
 *   S         = team round-win share (roundsWon / roundsPlayed)     // actual team result
 *   base      = K_Factor * teamMult * (S - E)
 *   perf      = clamp(Performance_K * perfMult * (score/matchAvg - 1),
 *                     ±(Max_Performance_Adjustment * perfMult))
 *   change    = clamp(base + perf, ±Max_Total_ELO_Change)
 *
 * teamAvg/oppAvg use each player's RUNNING Elo coming into the match, which is
 * why adding an experienced player to a match changes everyone's result: it
 * moves the team/opponent averages and therefore the expected score E.
 *
 * The exact shape (relative-to-average performance signal, the clamps) is our
 * reading of the config notes — tune the numbers in elo_config and they flow
 * through here with no code change.
 */

export type EloParams = {
  startElo: number;
  kFactor: number;
  performanceK: number;
  maxPerfAdj: number;
  maxTotalChange: number;
  divisor: number;
  sizeEnabled: boolean;
  baseline: number;
  teamKMin: number;
  teamKMax: number;
  perfMin: number;
  perfMax: number;
};

const num = (v: unknown, d: number) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function parseEloConfig(rows: { key: string; value: string | null }[]): EloParams {
  const m = new Map(rows.map((r) => [r.key, r.value]));
  const g = (k: string, d: number) => num(m.get(k), d);
  return {
    startElo: g("Starting_ELO", 1000),
    kFactor: g("K_Factor", 36),
    performanceK: g("Performance_K", 13),
    maxPerfAdj: g("Max_Performance_Adjustment", 16),
    maxTotalChange: g("Max_Total_ELO_Change", 30),
    divisor: g("Elo_Divisor", 400) || 400,
    sizeEnabled: String(m.get("Match_Size_Adjustment_Enabled") ?? "Yes").toLowerCase() === "yes",
    baseline: g("Match_Size_Baseline", 12) || 12,
    teamKMin: g("Team_K_Min_Multiplier", 0.6),
    teamKMax: g("Team_K_Max_Multiplier", 1.1),
    perfMin: g("Performance_Min_Multiplier", 1),
    perfMax: g("Performance_Max_Multiplier", 1.8),
  };
}

export type EloRow = {
  id: string;
  team: string;
  score: number;
  /** Running Elo coming into this match (start Elo for a first-timer / walk-in). */
  elo: number;
  roundsWon: number;
  roundsLost: number;
};

/** Compute per-player Elo change for one match. Returns id -> {before, change, after}. */
export function computeMatchElo(
  params: EloParams,
  rows: EloRow[],
): Map<string, { before: number; change: number; after: number }> {
  const out = new Map<string, { before: number; change: number; after: number }>();
  const size = rows.length;
  if (size === 0) return out;

  const teamMult = params.sizeEnabled ? clamp(params.baseline / size, params.teamKMin, params.teamKMax) : 1;
  const perfMult = params.sizeEnabled ? clamp(size / params.baseline, params.perfMin, params.perfMax) : 1;
  const matchAvg = rows.reduce((s, r) => s + r.score, 0) / size || 0;

  // Per-team average Elo + round-win share.
  const teams = [...new Set(rows.map((r) => r.team))];
  const teamElo = new Map<string, number>();
  const teamShare = new Map<string, number>();
  for (const t of teams) {
    const tr = rows.filter((r) => r.team === t);
    teamElo.set(t, tr.reduce((s, r) => s + r.elo, 0) / tr.length);
    const rep = tr[0];
    const played = rep.roundsWon + rep.roundsLost;
    teamShare.set(t, played > 0 ? rep.roundsWon / played : 0.5);
  }
  const totalElo = rows.reduce((s, r) => s + r.elo, 0);

  for (const r of rows) {
    const teamAvg = teamElo.get(r.team)!;
    const oppCount = size - rows.filter((x) => x.team === r.team).length;
    const oppAvg = oppCount > 0 ? (totalElo - teamAvg * rows.filter((x) => x.team === r.team).length) / oppCount : teamAvg;
    const E = 1 / (1 + Math.pow(10, (oppAvg - teamAvg) / params.divisor));
    const S = teamShare.get(r.team)!;
    const base = params.kFactor * teamMult * (S - E);
    const perfSignal = matchAvg > 0 ? r.score / matchAvg - 1 : 0;
    const perfCap = params.maxPerfAdj * perfMult;
    const perf = clamp(params.performanceK * perfMult * perfSignal, -perfCap, perfCap);
    const change = Math.round(clamp(base + perf, -params.maxTotalChange, params.maxTotalChange));
    out.set(r.id, { before: Math.round(r.elo), change, after: Math.round(r.elo) + change });
  }
  return out;
}
