import { fetchSheetAsObjects, parseNumericOr } from "@/lib/sheets";
import { CMS_REVALIDATE_SECONDS, CMS_URLS } from "./client";
import { isFallbackGunName } from "./weapons";

/**
 * lib/cms/player-armory.ts
 * --------------------------------------------------------------------
 * Player_Armory_Public sheet — one row per (player, gun).
 *
 * The sheet does most of the work: per-player aggregates with each gun
 * (matches used, K/D, kills, etc.), unlock state booleans, and unlock
 * progress numbers (pct + remaining + display text). The Gun_Player_Image
 * column already resolves to the right variant (used / locked) per row,
 * so the renderer can use that single field.
 *
 * Static gun spec extras not on this sheet (Gun_Length, Gun_Weight,
 * Gun_Range, Gun_Difficulty, Gun_Description, Gun_Unlock_Tier) come from
 * the Gun_Damage sheet via lib/cms/weapons.ts. The join lives in
 * lib/weapons/armory.ts.
 */

type PlayerArmoryRaw = Record<string, string> & {
  Gun_Name: string;
  Player_Nickname: string;
  Player_Profile_Pic: string;
  Player_Rank_Badge: string;
  Gun_Class: string;
  Gun_Tree_Branch: string;
  Gun_Used_Img: string;
  Gun_Locked_Img: string;
  Is_Default: string;
  Unlock_Type: string;
  Unlock_Prerequisite_Class: string;
  Unlock_Prerequisite_Gun: string;
  Unlock_Requirement_Points: string;
  Unlock_Requirement_Level: string;
  Unlock_Display_Text: string;
  Gun_Sort_Order: string;
  Player_Level: string;
  Matches_Used: string;
  Kills_Total: string;
  Avg_Kills: string;
  Deaths_Total: string;
  Hits_Total: string;
  Shots_Total: string;
  Damage_Total: string;
  Avg_Damage: string;
  Score_Total: string;
  Avg_Score: string;
  Avg_Accuracy: string;
  KD_Ratio: string;
  Wins_Using_Gun: string;
  Rounds_Won_Using_Gun: string;
  Avg_Match_Rating: string;
  Points_With_Prerequisite_Class: string;
  Points_With_Prerequisite_Gun: string;
  Points_Toward_Unlock: string;
  Gun_Is_Unlocked: string;
  Gun_Player_Status: string;
  Gun_Player_Image: string;
  Unlock_Progress_Pct: string;
  Unlock_Progress_Remaining: string;
  Unlock_Progress_Text: string;
  Has_Used_Gun: string;
  Gun_Display_title: string;
  Gun_Mag_Size: string;
  Gun_Damage: string;
  Gun_Reload: string;
  Gun_Fire_Rate: string;
};

export type PlayerArmoryRow = {
  // Identity
  gunName: string;
  playerNickname: string;
  playerProfilePic: string;
  playerRankBadge: string;
  playerLevel: number;

  // Gun meta
  gunClass: string;
  treeBranch: string;
  gunUsedImg: string;
  gunLockedImg: string;
  isDefault: boolean;
  sortOrder: number;
  gunDisplayTitle: string;

  // Unlock spec
  unlockType: string;
  unlockPrereqClass: string;
  unlockPrereqGun: string;
  unlockReqPoints: number;
  unlockReqLevel: number;
  unlockDisplayText: string;

  // Player view state (precomputed by the sheet)
  gunIsUnlocked: boolean;
  gunPlayerStatus: string;
  gunPlayerImage: string;
  hasUsedGun: boolean;

  // Unlock progress
  pointsWithPrereqClass: number;
  pointsWithPrereqGun: number;
  pointsTowardUnlock: number;
  unlockProgressPct: number;
  unlockProgressRemaining: number;
  unlockProgressText: string;

  // Per-player stats with this gun
  matchesUsed: number;
  killsTotal: number;
  avgKills: number;
  deathsTotal: number;
  hitsTotal: number;
  shotsTotal: number;
  damageTotal: number;
  avgDamage: number;
  scoreTotal: number;
  avgScore: number;
  avgAccuracy: number;
  kdRatio: number;
  winsUsingGun: number;
  roundsWonUsingGun: number;
  avgMatchRating: number;

  // Display extras already on this sheet (so cards/modals render even
  // when the Gun_Damage join misses).
  gunMagSize: number;
  gunDamage: number;
  gunReload: number;
  gunFireRate: string;
};

/**
 * Sheet image cells sometimes contain "#N/A" or other sheet error
 * strings instead of a URL (typical for locked rows where the image
 * lookup formula returns N/A). Treat any value that doesn't look like
 * an http(s) URL as missing — so renderers can apply their own
 * empty-state handling.
 */
const cleanImageUrl = (value: string | undefined): string => {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (!/^https?:\/\//i.test(trimmed)) return "";
  return trimmed;
};

export async function fetchPlayerArmory(): Promise<PlayerArmoryRow[]> {
  const result = await fetchSheetAsObjects<PlayerArmoryRaw>(
    CMS_URLS.playerArmory,
    CMS_REVALIDATE_SECONDS,
  );
  if (!result.ok) return [];

  const out: PlayerArmoryRow[] = [];
  for (const row of result.rows) {
    const gunName = (row.Gun_Name ?? "").trim();
    if (gunName === "" || isFallbackGunName(gunName)) continue;

    const playerNickname = (row.Player_Nickname ?? "").trim();
    if (playerNickname === "") continue;

    out.push({
      gunName,
      playerNickname,
      playerProfilePic: (row.Player_Profile_Pic ?? "").trim(),
      playerRankBadge: (row.Player_Rank_Badge ?? "").trim(),
      playerLevel: parseNumericOr(row.Player_Level, 0),

      gunClass: (row.Gun_Class ?? "").trim(),
      treeBranch: (row.Gun_Tree_Branch ?? "").trim(),
      gunUsedImg: cleanImageUrl(row.Gun_Used_Img),
      gunLockedImg: cleanImageUrl(row.Gun_Locked_Img),
      isDefault: parseBoolish(row.Is_Default),
      sortOrder: parseNumericOr(row.Gun_Sort_Order, 0),
      gunDisplayTitle: (row.Gun_Display_title ?? "").trim(),

      unlockType: (row.Unlock_Type ?? "").trim(),
      unlockPrereqClass: (row.Unlock_Prerequisite_Class ?? "").trim(),
      unlockPrereqGun: (row.Unlock_Prerequisite_Gun ?? "").trim(),
      unlockReqPoints: parseNumericOr(row.Unlock_Requirement_Points, 0),
      unlockReqLevel: parseNumericOr(row.Unlock_Requirement_Level, 0),
      unlockDisplayText: (row.Unlock_Display_Text ?? "").trim(),

      gunIsUnlocked: parseBoolish(row.Gun_Is_Unlocked),
      gunPlayerStatus: (row.Gun_Player_Status ?? "").trim(),
      gunPlayerImage: cleanImageUrl(row.Gun_Player_Image),
      hasUsedGun: parseBoolish(row.Has_Used_Gun),

      pointsWithPrereqClass: parseNumericOr(row.Points_With_Prerequisite_Class, 0),
      pointsWithPrereqGun: parseNumericOr(row.Points_With_Prerequisite_Gun, 0),
      pointsTowardUnlock: parseNumericOr(row.Points_Toward_Unlock, 0),
      unlockProgressPct: normalisePct(parseNumericOr(row.Unlock_Progress_Pct, 0)),
      unlockProgressRemaining: parseNumericOr(row.Unlock_Progress_Remaining, 0),
      unlockProgressText: (row.Unlock_Progress_Text ?? "").trim(),

      matchesUsed: parseNumericOr(row.Matches_Used, 0),
      killsTotal: parseNumericOr(row.Kills_Total, 0),
      avgKills: parseNumericOr(row.Avg_Kills, 0),
      deathsTotal: parseNumericOr(row.Deaths_Total, 0),
      hitsTotal: parseNumericOr(row.Hits_Total, 0),
      shotsTotal: parseNumericOr(row.Shots_Total, 0),
      damageTotal: parseNumericOr(row.Damage_Total, 0),
      avgDamage: parseNumericOr(row.Avg_Damage, 0),
      scoreTotal: parseNumericOr(row.Score_Total, 0),
      avgScore: parseNumericOr(row.Avg_Score, 0),
      avgAccuracy: parseNumericOr(row.Avg_Accuracy, 0),
      kdRatio: parseNumericOr(row.KD_Ratio, 0),
      winsUsingGun: parseNumericOr(row.Wins_Using_Gun, 0),
      roundsWonUsingGun: parseNumericOr(row.Rounds_Won_Using_Gun, 0),
      avgMatchRating: parseNumericOr(row.Avg_Match_Rating, 0),

      gunMagSize: parseNumericOr(row.Gun_Mag_Size, 0),
      gunDamage: parseNumericOr(row.Gun_Damage, 0),
      gunReload: parseNumericOr(row.Gun_Reload, 0),
      gunFireRate: (row.Gun_Fire_Rate ?? "").trim(),
    });
  }

  return out;
}

/**
 * Filter armory rows for a single player. Case-insensitive trimmed match
 * on Player_Nickname — same normalisation as findPlayerByOpsTag in
 * lib/player-stats/shared.ts so search bar inputs flow through unchanged.
 */
export function filterPlayerArmoryByOps(
  rows: PlayerArmoryRow[],
  opsTag: string,
): PlayerArmoryRow[] {
  const needle = opsTag.trim().toLowerCase();
  if (needle === "") return [];
  return rows.filter((r) => r.playerNickname.trim().toLowerCase() === needle);
}

function parseBoolish(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "true" || v === "yes" || v === "1";
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

/**
 * The sheet stores Unlock_Progress_Pct as a 0–1 fraction (e.g. 0.984
 * for 98.4%). Some published sheets evolve to 0–100; accept both by
 * treating values ≤ 1.0 as fractions and multiplying by 100. Same
 * heuristic the Armory dialog uses for accuracy. Always clamps to
 * [0, 100] after.
 */
function normalisePct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const asPct = n <= 1 ? n * 100 : n;
  return clampPct(asPct);
}
