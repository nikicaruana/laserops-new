/**
 * lib/match-report/engine.ts
 * --------------------------------------------------------------------
 * The Match Report engine. Given a match ID, fetches all necessary
 * data sources in parallel and assembles a single MatchReport object
 * that the page renders. Caller never has to touch the underlying
 * sheets directly.
 *
 * Sources joined here:
 *   - Game_ID_map         → match-level metadata (rounds, team scores)
 *   - Game_Data_Lookup    → per-player rows for the match
 *   - Accolades CMS       → accolade definitions / images / XP values
 *   - Ranking_System      → level → badge for XP card animations
 *
 * The ranking system + accolades are CMS data and pretty stable —
 * fetched once per match request and used for the lookups below.
 */

import {
  fetchGameDataRows,
  findMatchRows,
  type GameDataRow,
} from "@/lib/game-data/lookup";
import {
  fetchGameIdMap,
  findMatchById,
  listAllMatchIds,
  type GameInfo,
} from "@/lib/cms/game-id-map";
import {
  fetchAccolades,
  indexAccoladesByKey,
  accoladeKey,
  type Accolade,
} from "@/lib/cms/accolades";
import {
  fetchRankingSystem,
  type RankLevel,
} from "@/lib/cms/ranking-system";
import { parseNumericOr } from "@/lib/sheets";

/**
 * Per-player row for the match, with derived/joined fields ready
 * for rendering.
 */
export type MatchPlayer = {
  /** The raw GameDataRow — escape hatch for any column not surfaced
   *  here explicitly (e.g. accolade columns). */
  row: GameDataRow;
  // Identity
  nickname: string;
  profilePicUrl: string;
  // Match performance — pre-extracted for table display
  teamColor: string;
  teamColorLower: string; // lowercase for CSS class lookup
  level: number;
  rankBadgeUrl: string;
  score: number;
  kills: number;
  deaths: number;
  kd: number;
  accuracy: number;
  damage: number;
  totalXp: number;
  gunUsed: string;
  gunUsedImage: string;
  // Per-match ranks
  scoreRank: number;
  killsRank: number;
  deathsRank: number;
  kdRank: number;
  accuracyRank: number;
  damageRank: number;
  // Match-level XP info (for the XP card)
  matchRating: number;
  averageMatchScore: number;
  scorePerformanceDelta: number;
  // Team round wins (denormalised onto each player row for convenience)
  teamRoundsWon: number;
  teamRoundsLost: number;
  isWinner: boolean;
  teamBadgeImage: string;
  // XP detail (for the level card animation)
  xpFromPoints: number;
  xpFromWins: number;
  xpFromAccolades: number;
  /**
   * XP earned in THIS match (sum of points/wins/accolades). Distinct
   * from xpTotalAfterMatch (which is the player's lifetime running
   * total). Use this for the XP card's "+ X Total XP" headline.
   */
  xpEarnedThisMatch: number;
  xpTotalBeforeMatch: number;
  xpTotalAfterMatch: number;
  xpCurrentLevelBeforeMatch: number;
  xpCurrentLevelAfterMatch: number;
  xpCurrentLevelMinBeforeMatch: number;
  xpNextLevelMinBeforeMatch: number;
  xpLevelProgressStart: number;
  xpLevelProgressEnd: number;
  xpLevelUpInMatch: boolean;
  xpLevelBadgeImage: string;
  // Earned accolades — already joined to CMS metadata
  earnedAccolades: EarnedAccolade[];
};

export type EarnedAccolade = {
  accolade: Accolade;
};

export type MatchReport = {
  game: GameInfo;
  players: MatchPlayer[];
  ranks: RankLevel[];
  /** Match date, in whatever format the source sheet uses
   *  (typically YYYY-MM-DD or DD/MM/YYYY). Pulled from the first
   *  player row's LaserOps_Game_Date. Empty string if absent. */
  matchDate: string;
};

export type MatchReportResult =
  | { ok: true; report: MatchReport }
  | { ok: false; reason: "match-not-found" | "no-players" | "data-fetch-failed"; detail?: string };

/**
 * The list of accolade column suffixes. Hardcoded because the schema
 * is fixed; if a new accolade is added, this list expands.
 *
 * The exact column names in Game_Data_Lookup are `Accolade_${suffix}`
 * where suffix is the value below. The Accolades CMS sheet's
 * `Accolade_Name` column holds canonical display names, matched to
 * these via accoladeKey() — so these don't need to match CMS exactly,
 * just normalised forms must overlap.
 */
const ACCOLADE_COLUMN_SUFFIXES = [
  "MVP",
  "Reaper",
  "Kamikaze",
  "Tank",
  "Rambo",
  "Ammo_Saver",
  "Apex_Predator",
  "Eagle_Eye",
  "Spray_n_Pray",
  "Specialist",
  "Punisher",
  "Swiss_Cheese",
  "Ghost",
  "Heavy_Hitter",
  "Pacifist",
];

/**
 * Build the full MatchReport for a given match ID.
 *
 * Returns a result variant rather than throwing, so the page can
 * render appropriate empty/error states without try/catch sprawl.
 */
export async function fetchMatchReport(matchId: string): Promise<MatchReportResult> {
  const [gameDataResult, games, accolades, ranks] = await Promise.all([
    fetchGameDataRows(),
    fetchGameIdMap(),
    fetchAccolades(),
    fetchRankingSystem(),
  ]);

  const game = findMatchById(games, matchId);
  if (!game) {
    return { ok: false, reason: "match-not-found" };
  }

  if (!gameDataResult.ok) {
    return { ok: false, reason: "data-fetch-failed", detail: gameDataResult.error };
  }

  const matchRows = findMatchRows(gameDataResult.rows, matchId);
  if (matchRows.length === 0) {
    return { ok: false, reason: "no-players" };
  }

  const accoladesByKey = indexAccoladesByKey(accolades);
  const players = matchRows.map((row) => buildPlayer(row, accoladesByKey));

  // Sort by score descending — natural default for the table.
  players.sort((a, b) => b.score - a.score);

  // Match date: take from any player row (they all share the same match
  // date, since they all played in the same match). Picking the first
  // arbitrarily is fine.
  const matchDate = (matchRows[0]?.raw.LaserOps_Game_Date ?? "").trim();

  return {
    ok: true,
    report: { game, players, ranks, matchDate },
  };
}

/**
 * Fetch just the list of all known match IDs — used by the search
 * autocomplete. Lighter than fetchMatchReport since it only hits the
 * Game_ID_map sheet.
 */
export async function fetchAllMatchIds(): Promise<string[]> {
  const games = await fetchGameIdMap();
  return listAllMatchIds(games);
}

/* ============================================================
   Internals
   ============================================================ */

function buildPlayer(
  row: GameDataRow,
  accoladesByKey: Map<string, Accolade>,
): MatchPlayer {
  const earnedAccolades: EarnedAccolade[] = [];
  for (const suffix of ACCOLADE_COLUMN_SUFFIXES) {
    const value = row.raw[`Accolade_${suffix}`];
    if (parseFlexBool(value)) {
      const accolade = accoladesByKey.get(accoladeKey(suffix));
      if (accolade) {
        earnedAccolades.push({ accolade });
      } else {
        // Fallback: CMS sheet didn't have a row for this accolade
        // (e.g. it's not yet populated). Render the accolade anyway
        // with a derived display name and no description / xp / image.
        // This makes "I have a 1 in this column but the CMS row is
        // missing" visible to editors instead of silently dropping.
        earnedAccolades.push({
          accolade: {
            name: suffix.replace(/_/g, " "),
            key: accoladeKey(suffix),
            description: "",
            badgeUrl: "",
            xp: 0,
          },
        });
      }
    }
  }

  // Match score: prefer LaserOps_Score (computed) — falls back to raw points.
  const score = parseNumericOr(
    row.raw.LaserOps_Score ?? row.raw.PlayerRatePoints,
    0,
  );

  const teamColor = (row.raw.TeamColor ?? "").trim();

  return {
    row,
    nickname: row.nickname,
    profilePicUrl: row.profilePicUrl,
    teamColor,
    teamColorLower: teamColor.toLowerCase(),
    // Display the level the player ENTERED the match at — that's what
    // gives the per-match performance its context ("Glenn was at level 6
    // in this match"). The after-match level is still tracked separately
    // (xpCurrentLevelAfterMatch) for the XP card animation.
    level: parseNumericOr(row.raw.XP_Current_Level_Before_Match, 0),
    rankBadgeUrl: row.rankBadgeUrl,
    score,
    kills: parseNumericOr(row.raw.PlayerFragsCount, 0),
    deaths: parseNumericOr(row.raw.PlayerDeathsCount, 0),
    kd: parseNumericOr(row.raw.LaserOps_KD, 0),
    accuracy: parseNumericOr(row.raw.PlayerAccuracy, 0),
    damage: parseNumericOr(row.raw.LaserOps_Damage, 0),
    totalXp: parseNumericOr(row.raw.XP_Total, 0),
    gunUsed: (row.raw.LaserOps_Gun_Used ?? "").trim(),
    gunUsedImage: (row.raw.LaserOps_Gun_Used_Image ?? "").trim(),
    scoreRank: parseNumericOr(row.raw.LaserOps_Score_Rank, 0),
    killsRank: parseNumericOr(row.raw.LaserOps_Kills_Rank, 0),
    deathsRank: parseNumericOr(row.raw.LaserOps_Deaths_Rank, 0),
    kdRank: parseNumericOr(row.raw.LaserOps_KD_Rank, 0),
    accuracyRank: parseNumericOr(row.raw.LaserOps_Accuracy_Rank, 0),
    damageRank: parseNumericOr(row.raw.LaserOps_Damage_Rank, 0),
    matchRating: parseNumericOr(row.raw.LaserOps_Match_Rating, 0),
    averageMatchScore: parseNumericOr(row.raw.LaserOps_Match_Average_Score, 0),
    scorePerformanceDelta: parseNumericOr(
      row.raw.LaserOps_Score_Performance_Delta,
      0,
    ),
    teamRoundsWon: parseNumericOr(row.raw.LaserOps_Rounds_Won, 0),
    teamRoundsLost: parseNumericOr(row.raw.LaserOps_Rounds_Lost, 0),
    isWinner: parseFlexBool(row.raw.LaserOps_Team_Is_Winner),
    teamBadgeImage: (row.raw.LaserOps_Team_Badge_Image ?? "").trim(),
    xpFromPoints: parseNumericOr(row.raw.XP_From_Points, 0),
    xpFromWins: parseNumericOr(row.raw.XP_From_Wins, 0),
    xpFromAccolades: parseNumericOr(row.raw.XP_From_Accolades, 0),
    xpEarnedThisMatch: parseNumericOr(row.raw.XP_Total, 0),
    xpTotalBeforeMatch: parseNumericOr(row.raw.XP_Total_Before_Match, 0),
    xpTotalAfterMatch: parseNumericOr(row.raw.XP_Total_After_Match, 0),
    xpCurrentLevelBeforeMatch: parseNumericOr(
      row.raw.XP_Current_Level_Before_Match,
      0,
    ),
    xpCurrentLevelAfterMatch: parseNumericOr(
      row.raw.XP_Current_Level_After_Match,
      0,
    ),
    xpCurrentLevelMinBeforeMatch: parseNumericOr(
      row.raw.XP_Current_Level_Min_Before_Match,
      0,
    ),
    xpNextLevelMinBeforeMatch: parseNumericOr(
      row.raw.XP_Next_Level_Min_Before_Match,
      0,
    ),
    xpLevelProgressStart: parseNumericOr(row.raw.XP_Level_Progress_Start, 0),
    xpLevelProgressEnd: parseNumericOr(row.raw.XP_Level_Progress_End, 0),
    xpLevelUpInMatch: parseFlexBool(row.raw.XP_Level_Up_In_Match),
    xpLevelBadgeImage: (row.raw.XP_Level_Badge_Image ?? "").trim(),
    earnedAccolades,
  };
}

/**
 * Find a player within a match report by nickname. Case-insensitive.
 */
export function findPlayerInReport(
  report: MatchReport,
  nickname: string,
): MatchPlayer | undefined {
  const needle = nickname.trim().toLowerCase();
  if (needle === "") return undefined;
  return report.players.find((p) => p.nickname.toLowerCase() === needle);
}

/**
 * Parse a CSV cell as a boolean, accepting common spreadsheet
 * representations: "TRUE"/"FALSE", "1"/"0", "yes"/"no". Returns false
 * for empty strings or anything unrecognised — defensive default.
 */
function parseFlexBool(value: string | undefined): boolean {
  const v = (value ?? "").trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "y";
}
