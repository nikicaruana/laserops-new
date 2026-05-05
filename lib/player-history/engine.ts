/**
 * lib/player-history/engine.ts
 * --------------------------------------------------------------------
 * Fetches all per-player match rows and shapes them for the History
 * page: chart series, personal records, match summary table.
 *
 * Source: Game_Data_Lookup_Public — one row per player per match. We
 * filter to a single player's rows here.
 *
 * Result is shaped so the page can render directly without further
 * transformation. The page is a server component fetching the full
 * dataset once (cached at the sheet layer) and then filtering/serving.
 */

import {
  fetchGameDataRows,
  type GameDataRow,
} from "@/lib/game-data/lookup";
import { fetchRankingSystem, type RankLevel, getRankByLevel } from "@/lib/cms/ranking-system";
import { parseNumericOr } from "@/lib/sheets";

/**
 * Per-match record for one player. Pre-extracts the columns the
 * History page needs so component code stays free of raw column reads.
 */
export type PlayerMatch = {
  matchId: string;
  date: string;
  yearMonth: string;
  // Identity
  nickname: string;
  profilePicUrl: string;
  // Performance
  score: number;
  matchRating: number;
  averageMatchScore: number;
  scorePerformanceDelta: number;
  kills: number;
  deaths: number;
  kd: number;
  accuracy: number;
  shots: number;
  damage: number;
  gunUsed: string;
  gunUsedImage: string;
  teamColor: string;
  isWinner: boolean;
  // ELO
  eloBefore: number;
  eloAfter: number;
  eloChange: number;
  // XP
  xpEarned: number;
  level: number;
};

/**
 * Single best-ever entry for one metric. The match ID lets the user
 * trace back which match the record came from.
 */
export type PersonalRecord = {
  metric: "score" | "matchRating" | "kills" | "kd" | "accuracy" | "damage";
  label: string;
  value: number;
  formatted: string;
  matchId: string;
};

export type PlayerHistory = {
  matches: PlayerMatch[];
  records: PersonalRecord[];
  /** Most recent rank badge URL — for the profile card. */
  currentRankBadgeUrl: string;
  /** Most recent rank name. */
  currentRankName: string;
  /** Most recent level number (XP-based). Used to render "Level N"
   *  underneath the rank badge in the profile card. */
  currentLevel: number;
  /** Most recent profile picture URL. */
  profilePicUrl: string;
};

export type PlayerHistoryResult =
  | { ok: true; history: PlayerHistory }
  | { ok: false; reason: "player-not-found" | "data-fetch-failed"; detail?: string };

/**
 * Fetch the full history for a single player by nickname.
 *
 * Returns a discriminated result rather than throwing so the page can
 * render appropriate empty/error states without try/catch sprawl.
 */
export async function fetchPlayerHistory(
  nickname: string,
): Promise<PlayerHistoryResult> {
  const [gameDataResult, ranks] = await Promise.all([
    fetchGameDataRows(),
    fetchRankingSystem(),
  ]);

  if (!gameDataResult.ok) {
    return { ok: false, reason: "data-fetch-failed", detail: gameDataResult.error };
  }

  const needle = nickname.trim().toLowerCase();
  if (needle === "") {
    return { ok: false, reason: "player-not-found" };
  }

  const playerRows = gameDataResult.rows.filter(
    (r) => r.nickname.toLowerCase() === needle,
  );

  if (playerRows.length === 0) {
    return { ok: false, reason: "player-not-found" };
  }

  const matches = playerRows.map((row) => buildPlayerMatch(row));

  // Sort matches chronologically (oldest first) so chart series
  // render left-to-right as time progresses. The Match Summaries
  // table will sort independently via its own column-header sorts.
  matches.sort((a, b) => sortByMatchId(a.matchId, b.matchId));

  const records = computePersonalRecords(matches);

  // Most recent match (last in sorted order) is the source of "current"
  // identity fields like the rank badge — these change over time.
  const mostRecent = matches[matches.length - 1];
  const currentRank: RankLevel | undefined = getRankByLevel(ranks, mostRecent.level);
  return {
    ok: true,
    history: {
      matches,
      records,
      currentRankBadgeUrl: currentRank?.badgeUrl ?? "",
      currentRankName: currentRank?.rankName ?? "",
      currentLevel: mostRecent.level,
      profilePicUrl: mostRecent.profilePicUrl,
    },
  };
}

/* ============================================================
   Helpers
   ============================================================ */

function buildPlayerMatch(row: GameDataRow): PlayerMatch {
  const score = parseNumericOr(
    row.raw.LaserOps_Score ?? row.raw.PlayerRatePoints,
    0,
  );
  return {
    matchId: row.matchId,
    date: (row.raw.LaserOps_Game_Date ?? "").trim(),
    yearMonth: (row.raw.LaserOps_Game_YearMonth ?? "").trim(),
    nickname: row.nickname,
    profilePicUrl: row.profilePicUrl,
    score,
    matchRating: parseNumericOr(row.raw.LaserOps_Match_Rating, 0),
    averageMatchScore: parseNumericOr(row.raw.LaserOps_Match_Average_Score, 0),
    scorePerformanceDelta: parseNumericOr(
      row.raw.LaserOps_Score_Performance_Delta,
      0,
    ),
    kills: parseNumericOr(row.raw.PlayerFragsCount, 0),
    deaths: parseNumericOr(row.raw.PlayerDeathsCount, 0),
    kd: parseNumericOr(row.raw.LaserOps_KD, 0),
    accuracy: parseNumericOr(row.raw.PlayerAccuracy, 0),
    shots: parseNumericOr(row.raw.PlayerShotsCount, 0),
    damage: parseNumericOr(row.raw.LaserOps_Damage, 0),
    gunUsed: (row.raw.LaserOps_Gun_Used ?? "").trim(),
    gunUsedImage: (row.raw.LaserOps_Gun_Used_Image ?? "").trim(),
    teamColor: (row.raw.TeamColor ?? "").trim(),
    isWinner: parseNumericOr(row.raw.LaserOps_Team_Is_Winner, 0) === 1,
    eloBefore: parseNumericOr(row.raw.ELO_Before_Match, 0),
    eloAfter: parseNumericOr(row.raw.ELO_After_Match, 0),
    eloChange: parseNumericOr(row.raw.ELO_Change, 0),
    xpEarned: parseNumericOr(row.raw.XP_Total, 0),
    level: parseNumericOr(row.raw.XP_Current_Level_After_Match, 0),
  };
}

/**
 * Sort by match ID assuming the LO-YYYY-NN format (e.g. LO-2026-09).
 * We lexicographically sort which works correctly for matches in the
 * same year. For multi-year ranges this still works because the year
 * portion is fixed-width.
 *
 * If the match ID format changes, this function will need updating.
 */
function sortByMatchId(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true });
}

/**
 * Find the player's all-time best in each tracked metric.
 *
 * Tied values: we take the FIRST match in chronological order with
 * that value (i.e. the earliest achievement of the record). Subsequent
 * ties don't displace it. This matches the human intuition of "their
 * record" being the first time they hit a number.
 *
 * If a metric has zero matches with non-zero values, we still emit a
 * record (value: 0) so the layout stays stable. The matchId will be
 * empty in that case.
 */
function computePersonalRecords(matches: PlayerMatch[]): PersonalRecord[] {
  const tracked: Array<{
    metric: PersonalRecord["metric"];
    label: string;
    extract: (m: PlayerMatch) => number;
    format: (v: number) => string;
  }> = [
    { metric: "score", label: "Score", extract: (m) => m.score, format: (v) => v.toLocaleString("en-US") },
    { metric: "matchRating", label: "Match Rating", extract: (m) => m.matchRating, format: (v) => v.toFixed(2) },
    { metric: "kills", label: "Kills", extract: (m) => m.kills, format: (v) => v.toString() },
    { metric: "kd", label: "K/D", extract: (m) => m.kd, format: (v) => v.toFixed(2) },
    { metric: "accuracy", label: "Accuracy", extract: (m) => m.accuracy, format: (v) => `${Math.round(v * 100)}%` },
    { metric: "damage", label: "Damage", extract: (m) => m.damage, format: (v) => v.toLocaleString("en-US") },
  ];

  const records: PersonalRecord[] = [];
  for (const t of tracked) {
    let best = -Infinity;
    let bestMatchId = "";
    for (const m of matches) {
      const v = t.extract(m);
      if (v > best) {
        best = v;
        bestMatchId = m.matchId;
      }
    }
    if (!Number.isFinite(best)) best = 0;
    records.push({
      metric: t.metric,
      label: t.label,
      value: best,
      formatted: t.format(best),
      matchId: bestMatchId,
    });
  }
  return records;
}
