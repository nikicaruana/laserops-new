/**
 * lib/ingestion/score.ts
 * --------------------------------------------------------------------
 * Compute the LaserOps score (from the admin-configured scoring formula) for
 * each player in a parsed round. Uses JSON-accurate stats; when spawn camping
 * is set to Void, the spawn-flagged kills and damage are removed before scoring
 * so they earn nothing. Preview/commit share this – no writes here.
 */
import { computeRaw, type ScoreFormula } from "@/lib/scoring/formula";
import type { Round } from "@/lib/ingestion/round-parser";
import { effectiveCaptures, type EffectiveCaptures } from "@/lib/ingestion/effective";

/**
 * Exploit Control inputs (from base_trading_config). When supplied, scoring uses
 * EFFECTIVE captures/hold: sub-min-hold non-burn captures are excluded, and
 * same-player recaptures are scored at `recapturePoints` instead of the formula's
 * normal capture weight. Omit to score raw captures (back-compat).
 */
export type ScoreExploitOpts = {
  minHoldSeconds?: number | null;
  recaptureWindowSeconds?: number | null;
  recapturePoints?: number | null;
};

/** Sum of the formula's additive weight on `captures` (the normal per-capture value). */
function captureWeight(formula: ScoreFormula): number {
  return formula.groups
    .flatMap((g) => g.baseTerms)
    .filter((t) => t.stat === "captures")
    .reduce((s, t) => s + t.weight, 0);
}

export function laserOpsScores(
  round: Round,
  formula: ScoreFormula,
  voidSpawn: boolean,
  exploit?: ScoreExploitOpts,
  precomputedEff?: EffectiveCaptures,
): Record<number, number> {
  const eff = precomputedEff
    ?? (exploit
      ? effectiveCaptures(round, { minHoldSeconds: exploit.minHoldSeconds, recaptureWindowSeconds: exploit.recaptureWindowSeconds })
      : null);
  const capW = captureWeight(formula);
  const out: Record<number, number> = {};
  for (const p of round.players) {
    const pid = p.in_game_player_id;
    const c = round.final_player_counters?.[pid];
    if (!c) {
      out[pid] = 0;
      continue;
    }
    const spawnK = voidSpawn ? round.spawn_kills_by?.[pid] ?? 0 : 0;
    const spawnD = voidSpawn ? round.spawn_damage_by?.[pid] ?? 0 : 0;
    const frags = Math.max(0, c.frags - spawnK);
    const damage = Math.max(0, (round.damage_dealt?.[pid] ?? 0) - spawnD);
    const normalCaps = eff ? eff.captures[pid] ?? 0 : c.captures;
    const recaps = eff ? eff.recaptures[pid] ?? 0 : 0;
    const stats: Record<string, number> = {
      frags,
      damage,
      // Feed all counting captures at the formula weight; recaptures get discounted below.
      captures: normalCaps + recaps,
      hold: eff ? eff.holdSeconds[pid] ?? 0 : round.hold_seconds?.[pid] ?? 0,
      accuracy: c.shots > 0 ? c.hits / c.shots : 0,
      kd: c.deaths > 0 ? frags / c.deaths : frags,
    };
    let raw = computeRaw(formula, stats);
    // Recapture discount: each recapture is worth recapturePoints, not capW.
    if (eff && exploit?.recapturePoints != null && recaps > 0) {
      raw -= Math.max(0, capW - exploit.recapturePoints) * recaps;
    }
    out[pid] = Math.max(0, Math.ceil(raw));
  }
  return out;
}
