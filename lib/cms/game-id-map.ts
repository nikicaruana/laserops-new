import { fetchSheetAsObjects, parseNumericOr } from "@/lib/sheets";
import { CMS_REVALIDATE_SECONDS, CMS_URLS } from "./client";

/**
 * lib/cms/game-id-map.ts
 * --------------------------------------------------------------------
 * Match-level metadata, one row per LaserOps_Match_ID. Provides the
 * round-by-round summary that drives the Match Report's overview card:
 *
 *   - Round wins per team (Red/Blue/Yellow)
 *   - Team rating scores
 *   - Winning + losing team designation (with badge URLs)
 *   - Match flags (Is_Private_Match, Is_Double_XP)
 *   - Game date metadata (year, raw game id)
 *
 * The Match Report's player table comes from Game_Data_Lookup_PUBLIC
 * filtered by Match_ID; the OVERVIEW (header card) comes from this
 * sheet. They join on LaserOps_Match_ID.
 *
 * 3-team support: matches can have 3 teams (Red/Blue/Yellow). We expose
 * the raw counts and ratings for all three colours; consumers decide
 * what to render based on which teams have non-zero data.
 */

type GameIdMapRaw = Record<string, string> & {
  Raw_GameId: string;
  GameStartTimeYear: string;
  Game_No: string;
  LaserOps_Match_ID: string;
  Red_Round_Wins: string;
  Blue_Round_Wins: string;
  Yellow_Round_Wins: string;
  Is_Private_Match: string;
  Is_Double_XP: string;
  Red_Team_Rating: string;
  Blue_Team_Rating: string;
  Yellow_Team_Rating: string;
  Winning_Team_Rounds: string;
  Losing_Team_Rounds: string;
  Winning_Team: string;
  Losing_Team: string;
  Winning_Team_Rating: string;
  Losing_Team_Rating: string;
  Winning_Team_Badge: string;
  Losing_Team_Badge: string;
};

export type TeamColor = "Red" | "Blue" | "Yellow";

export type GameInfo = {
  matchId: string;
  rawGameId: string;
  gameStartTimeYear: string;
  gameNo: string;
  isPrivate: boolean;
  isDoubleXp: boolean;
  // Per-team data — stored for all three colours regardless of whether
  // each team played. Consumers filter by non-zero rating/rounds to
  // know which teams actually participated.
  teams: {
    red: { roundWins: number; rating: number };
    blue: { roundWins: number; rating: number };
    yellow: { roundWins: number; rating: number };
  };
  // Outcome — derived from the sheet's pre-computed Winning_Team field.
  // Useful for rendering the "blue won 5-0" narrative when there's a
  // clean winner; falls back to per-team display when not.
  winningTeam: string;
  losingTeam: string;
  winningTeamRounds: number;
  losingTeamRounds: number;
  winningTeamRating: number;
  losingTeamRating: number;
  winningTeamBadge: string;
  losingTeamBadge: string;
};

export async function fetchGameIdMap(): Promise<GameInfo[]> {
  const result = await fetchSheetAsObjects<GameIdMapRaw>(
    CMS_URLS.gameIdMap,
    CMS_REVALIDATE_SECONDS,
  );
  if (!result.ok) return [];

  const out: GameInfo[] = [];
  for (const row of result.rows) {
    const matchId = (row.LaserOps_Match_ID ?? "").trim();
    if (matchId === "") continue;
    out.push({
      matchId,
      rawGameId: (row.Raw_GameId ?? "").trim(),
      gameStartTimeYear: (row.GameStartTimeYear ?? "").trim(),
      gameNo: (row.Game_No ?? "").trim(),
      isPrivate: parseBool(row.Is_Private_Match),
      isDoubleXp: parseBool(row.Is_Double_XP),
      teams: {
        red: {
          roundWins: parseNumericOr(row.Red_Round_Wins, 0),
          rating: parseNumericOr(row.Red_Team_Rating, 0),
        },
        blue: {
          roundWins: parseNumericOr(row.Blue_Round_Wins, 0),
          rating: parseNumericOr(row.Blue_Team_Rating, 0),
        },
        yellow: {
          roundWins: parseNumericOr(row.Yellow_Round_Wins, 0),
          rating: parseNumericOr(row.Yellow_Team_Rating, 0),
        },
      },
      winningTeam: (row.Winning_Team ?? "").trim(),
      losingTeam: (row.Losing_Team ?? "").trim(),
      winningTeamRounds: parseNumericOr(row.Winning_Team_Rounds, 0),
      losingTeamRounds: parseNumericOr(row.Losing_Team_Rounds, 0),
      winningTeamRating: parseNumericOr(row.Winning_Team_Rating, 0),
      losingTeamRating: parseNumericOr(row.Losing_Team_Rating, 0),
      winningTeamBadge: (row.Winning_Team_Badge ?? "").trim(),
      losingTeamBadge: (row.Losing_Team_Badge ?? "").trim(),
    });
  }
  return out;
}

/**
 * Look up a single match by ID. Case-insensitive comparison so user
 * input variations (lo-2026-10 vs LO-2026-10) both resolve.
 */
export function findMatchById(
  games: GameInfo[],
  matchId: string,
): GameInfo | undefined {
  const needle = matchId.trim().toLowerCase();
  if (needle === "") return undefined;
  return games.find((g) => g.matchId.toLowerCase() === needle);
}

/**
 * Return all match IDs sorted descending by year + game number.
 * Used by the search input's autocomplete.
 */
export function listAllMatchIds(games: GameInfo[]): string[] {
  return [...games]
    .sort((a, b) => {
      // Sort by year descending, then game number descending — most
      // recent matches first.
      if (a.gameStartTimeYear !== b.gameStartTimeYear) {
        return b.gameStartTimeYear.localeCompare(a.gameStartTimeYear);
      }
      const aNum = parseInt(a.gameNo, 10) || 0;
      const bNum = parseInt(b.gameNo, 10) || 0;
      return bNum - aNum;
    })
    .map((g) => g.matchId);
}

function parseBool(value: string | undefined): boolean {
  const v = (value ?? "").trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}
