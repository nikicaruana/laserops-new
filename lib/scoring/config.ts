/**
 * lib/scoring/config.ts
 * --------------------------------------------------------------------
 * Loads the admin-authoritative scoring config for a game mode:
 *   - score_formula        -> the kill + objective weighted-sum formula
 *   - base_trading_config  -> min hold for a capture, recapture window + points
 *   - spawn_camp_config    -> spawn-trap window + consequence
 * These drive buildMatchReportV2 at publish (and the live scoreboard), so what an
 * admin sets in /admin/scoring + /admin/exploit-control is exactly how matches
 * score. Falls back to the locked launch defaults if a row is missing.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseFormula, type ScoreFormula } from "./formula";

export type ScoringRuntime = {
  formula: ScoreFormula;
  /** Passed to buildMatchReportV2 opts.scoring (thresholds + recapture points;
   *  capture/hold points come from the formula). */
  scoring: {
    spawnWindowSeconds: number;
    minHoldSeconds: number;
    recaptureWindowSeconds: number;
    recapturePoints: number;
  };
  spawnConsequence: "void" | "penalty" | "flag" | "ignore";
  spawnPenaltyPoints: number;
};

// Launch-locked defaults (also what the admin panels are set to), used when a
// config row is absent so scoring never silently breaks.
const DEFAULTS = {
  spawnWindowSeconds: 4,
  minHoldSeconds: 3,
  recaptureWindowSeconds: 20,
  recapturePoints: 75,
  spawnConsequence: "void" as const,
  spawnPenaltyPoints: 0,
};

export async function getScoringConfig(
  client: SupabaseClient,
  modeSlug = "domination",
): Promise<ScoringRuntime> {
  const [{ data: sf }, { data: bt }, { data: sc }] = await Promise.all([
    client.from("score_formula").select("structure").eq("mode_slug", modeSlug).maybeSingle(),
    client
      .from("base_trading_config")
      .select("min_hold_seconds, recapture_window_seconds, recapture_same_player_points")
      .eq("mode_slug", modeSlug)
      .maybeSingle(),
    client
      .from("spawn_camp_config")
      .select("protection_window_seconds, consequence_mode, penalty_points")
      .eq("mode_slug", modeSlug)
      .maybeSingle(),
  ]);

  return {
    formula: parseFormula(sf?.structure),
    scoring: {
      spawnWindowSeconds: Number(sc?.protection_window_seconds ?? DEFAULTS.spawnWindowSeconds),
      minHoldSeconds: Number(bt?.min_hold_seconds ?? DEFAULTS.minHoldSeconds),
      recaptureWindowSeconds: Number(bt?.recapture_window_seconds ?? DEFAULTS.recaptureWindowSeconds),
      recapturePoints: Number(bt?.recapture_same_player_points ?? DEFAULTS.recapturePoints),
    },
    spawnConsequence: (sc?.consequence_mode as ScoringRuntime["spawnConsequence"]) ?? DEFAULTS.spawnConsequence,
    spawnPenaltyPoints: Number(sc?.penalty_points ?? DEFAULTS.spawnPenaltyPoints),
  };
}
