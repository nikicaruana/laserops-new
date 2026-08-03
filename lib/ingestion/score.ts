/**
 * lib/ingestion/score.ts
 * --------------------------------------------------------------------
 * Compute the LaserOps score (from the admin-configured scoring formula) for
 * each player in a parsed round. Uses JSON-accurate stats; when spawn camping
 * is set to Void, the spawn-flagged kills and damage are removed before scoring
 * so they earn nothing. Preview/commit share this — no writes here.
 */
import { computeScore, type ScoreFormula } from "@/lib/scoring/formula";
import type { Round } from "@/lib/ingestion/round-parser";

export function laserOpsScores(
  round: Round,
  formula: ScoreFormula,
  voidSpawn: boolean,
): Record<number, number> {
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
    const stats: Record<string, number> = {
      frags,
      damage,
      captures: c.captures,
      hold: round.hold_seconds?.[pid] ?? 0,
      accuracy: c.shots > 0 ? c.hits / c.shots : 0,
      kd: c.deaths > 0 ? frags / c.deaths : frags,
    };
    out[pid] = computeScore(formula, stats);
  }
  return out;
}
