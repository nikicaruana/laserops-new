import { fetchSheetAsObjects, parseNumericOr } from "@/lib/sheets";
import { CMS_REVALIDATE_SECONDS, CMS_URLS } from "./client";

/**
 * lib/cms/ranking-system.ts
 * --------------------------------------------------------------------
 * Level / rank metadata. One row per level with:
 *   - Level: integer (1..N)
 *   - Rank_Name: e.g. "Recruit", "Operative", "Specialist"
 *   - Score_Threshold: minimum lifetime XP to be at this level
 *   - Est_Games: rough estimate of games to reach this level (UI hint)
 *   - Rank_Badge: URL to the badge image
 *
 * Primarily used by the Match Report's XP card animation: when a player
 * levels up during a match (or even multiple times), we need badge
 * images for each intermediate level so the animation can transition
 * through them.
 *
 * Game_Data_Lookup already has XP_Total_Before/After + Level_Before/After
 * + thresholds for the current level — sufficient for the basic case.
 * Where this sheet matters is when Level_After - Level_Before > 1, i.e.
 * the player passed through intermediate levels we need badges for.
 */

type RankingSystemRaw = Record<string, string> & {
  Level: string;
  Rank_Name: string;
  Score_Threshold: string;
  Est_Games: string;
  Rank_Badge: string;
};

export type RankLevel = {
  level: number;
  rankName: string;
  /** Minimum total XP to be at this level. */
  scoreThreshold: number;
  estGames: number;
  badgeUrl: string;
};

export async function fetchRankingSystem(): Promise<RankLevel[]> {
  const result = await fetchSheetAsObjects<RankingSystemRaw>(
    CMS_URLS.rankingSystem,
    CMS_REVALIDATE_SECONDS,
  );
  if (!result.ok) return [];

  const out: RankLevel[] = [];
  for (const row of result.rows) {
    const level = parseNumericOr(row.Level, NaN);
    if (!Number.isFinite(level)) continue;
    out.push({
      level,
      rankName: (row.Rank_Name ?? "").trim(),
      scoreThreshold: parseNumericOr(row.Score_Threshold, 0),
      estGames: parseNumericOr(row.Est_Games, 0),
      badgeUrl: (row.Rank_Badge ?? "").trim(),
    });
  }
  return out.sort((a, b) => a.level - b.level);
}

/**
 * Look up a level's metadata. Returns undefined if no matching level.
 */
export function getRankByLevel(
  ranks: RankLevel[],
  level: number,
): RankLevel | undefined {
  return ranks.find((r) => r.level === level);
}
