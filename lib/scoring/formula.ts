/**
 * lib/scoring/formula.ts
 * --------------------------------------------------------------------
 * Configurable match-score formula model + interpreter. The formula is a set
 * of GROUPS; the score is the sum of the groups, rounded up. Each group is:
 *
 *   groupValue = ( Σ baseTerms: stat × weight ) × ( Π multipliers: 1 + stat × weight )
 *   score      = ceil( Σ groupValue )
 *
 * A block is just { stat, weight }; whether it's additive or a multiplier is
 * decided by which list it sits in — moving it between the two changes its
 * role. Pure + dependency-free so both the admin preview and the (future)
 * ingestion engine compute identically from the same stored structure.
 */

export type FormulaBlock = { id: string; stat: string; weight: number };
export type FormulaGroup = {
  id: string;
  label: string;
  baseTerms: FormulaBlock[];
  multipliers: FormulaBlock[];
};
export type ScoreFormula = { groups: FormulaGroup[] };

/** Stats the formula can reference. Add here as ingestion exposes more. */
export const FORMULA_STATS: { key: string; label: string }[] = [
  { key: "frags", label: "Kills" },
  { key: "damage", label: "Damage" },
  { key: "captures", label: "Captures" },
  { key: "hold", label: "Hold time" },
  { key: "accuracy", label: "Accuracy" },
  { key: "kd", label: "K/D" },
];

export const statLabel = (key: string): string =>
  FORMULA_STATS.find((s) => s.key === key)?.label ?? key;

export function computeGroupValue(
  group: FormulaGroup,
  stats: Record<string, number>,
): number {
  const base = group.baseTerms.reduce((s, t) => s + (stats[t.stat] ?? 0) * t.weight, 0);
  const mult = group.multipliers.reduce((m, t) => m * (1 + (stats[t.stat] ?? 0) * t.weight), 1);
  return base * mult;
}

/** Raw (pre-round) total across all groups. */
export function computeRaw(formula: ScoreFormula, stats: Record<string, number>): number {
  return formula.groups.reduce((s, g) => s + computeGroupValue(g, stats), 0);
}

export function computeScore(formula: ScoreFormula, stats: Record<string, number>): number {
  return Math.ceil(computeRaw(formula, stats));
}

/** Default formula = the original fixed shape (all terms in one group). */
export function defaultFormula(): ScoreFormula {
  return {
    groups: [
      {
        id: "g-default",
        label: "Match score",
        baseTerms: [
          { id: "b-frags", stat: "frags", weight: 50 },
          { id: "b-damage", stat: "damage", weight: 0.2 },
          { id: "b-captures", stat: "captures", weight: 0 },
          { id: "b-hold", stat: "hold", weight: 0 },
        ],
        multipliers: [
          { id: "m-accuracy", stat: "accuracy", weight: 0.2 },
          { id: "m-kd", stat: "kd", weight: 0.12 },
        ],
      },
    ],
  };
}

/** Defensive parse — falls back to the default if the stored JSON is unusable. */
export function parseFormula(raw: unknown): ScoreFormula {
  if (
    raw &&
    typeof raw === "object" &&
    Array.isArray((raw as ScoreFormula).groups)
  ) {
    return raw as ScoreFormula;
  }
  return defaultFormula();
}
