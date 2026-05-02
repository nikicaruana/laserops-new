import { fetchSheetAsObjects, parseNumericOr } from "@/lib/sheets";
import { CMS_REVALIDATE_SECONDS, CMS_URLS } from "./client";

/**
 * Raw shape of a Challenges row from the CMS.
 */
type ChallengeRaw = Record<string, string> & {
  Season_Number: string;
  Challenge_Number: string;
  Challenge_Name: string;
  Description: string;
  Prize: string;
  Priority: string;
  Source_Mode: string;
  Metric: string;
  Tiebreak_1: string;
  Tiebreak_2: string;
  Top_N: string;
  Prize_Cutoff: string;
};

/**
 * The three supported data sources for a challenge. Each maps to a
 * different fetch + ranking pipeline in season-challenges.ts.
 *
 *   - period_summed: pull from Leaderboard_Period_Stats, group by
 *     player, sum the metric across all months in the season window.
 *   - period_max: pull from Leaderboard_Period_Stats, group by player,
 *     take the highest single-month value of the metric.
 *   - match_top: pull from Game_Data_Lookup_PUBLIC, do not aggregate —
 *     return raw rows ordered by metric. A single player can appear
 *     multiple times for different matches.
 */
export type ChallengeSourceMode = "period_summed" | "period_max" | "match_top";

/**
 * Typed challenge after parsing.
 */
export type Challenge = {
  seasonNumber: number;
  challengeNumber: number;
  name: string;
  description: string;
  prize: string;
  /**
   * Display priority — tie-break order when a player wins multiple
   * challenges and there's a "one prize per player" rule. Lower number
   * = higher priority.
   */
  priority: number;
  sourceMode: ChallengeSourceMode;
  /** Raw column name in the source sheet to rank players by. */
  metric: string;
  /**
   * Tie-break computations to apply in order. Values reference named
   * functions in lib/cms/tiebreaks.ts. Empty strings are treated as "no
   * tie-break at this position".
   */
  tiebreak1: string;
  tiebreak2: string;
  /** How many rows to display in the leaderboard table. */
  topN: number;
  /**
   * Cutoff for "winning" a prize. The first Prize_Cutoff rows get
   * winner-style visual treatment (e.g. yellow accent, trophy badge).
   * Rows after this are shown but visually subordinated.
   */
  prizeCutoff: number;
};

/**
 * Fetch all challenges. Optionally filter to a specific season.
 *
 * Returns sorted by Priority ascending (lower priority value = shown
 * first / more prominent).
 */
export async function fetchChallenges(
  seasonNumber?: number,
): Promise<Challenge[]> {
  const result = await fetchSheetAsObjects<ChallengeRaw>(
    CMS_URLS.challenges,
    CMS_REVALIDATE_SECONDS,
  );
  if (!result.ok) {
    return [];
  }

  const challenges: Challenge[] = [];
  for (const row of result.rows) {
    const sn = parseNumericOr(row.Season_Number, NaN);
    if (!Number.isFinite(sn)) continue;
    if (seasonNumber !== undefined && sn !== seasonNumber) continue;

    const sourceMode = normalizeSourceMode(row.Source_Mode);
    if (!sourceMode) continue; // unknown source mode → skip; safer than rendering wrong data

    const cn = parseNumericOr(row.Challenge_Number, NaN);
    if (!Number.isFinite(cn)) continue;

    challenges.push({
      seasonNumber: sn,
      challengeNumber: cn,
      name: (row.Challenge_Name ?? "").trim(),
      description: (row.Description ?? "").trim(),
      prize: (row.Prize ?? "").trim(),
      priority: parseNumericOr(row.Priority, 999),
      sourceMode,
      metric: (row.Metric ?? "").trim(),
      tiebreak1: (row.Tiebreak_1 ?? "").trim(),
      tiebreak2: (row.Tiebreak_2 ?? "").trim(),
      topN: Math.max(1, parseNumericOr(row.Top_N, 5)),
      prizeCutoff: Math.max(0, parseNumericOr(row.Prize_Cutoff, 2)),
    });
  }

  return challenges.sort((a, b) => a.priority - b.priority);
}

/* ---------- internals ---------- */

function normalizeSourceMode(raw: string | undefined): ChallengeSourceMode | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "period_summed" || value === "period_max" || value === "match_top") {
    return value;
  }
  return null;
}
