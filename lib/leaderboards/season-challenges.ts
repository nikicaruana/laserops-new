/**
 * lib/leaderboards/season-challenges.ts
 * --------------------------------------------------------------------
 * The engine that turns a (Season, Challenge) into a ranked list of
 * entries ready for rendering.
 *
 * Branches on Challenge.sourceMode:
 *
 *   period_summed:
 *     - Filter Leaderboard_Period_Stats by season window
 *     - Group by player, sum the metric column
 *     - Sort descending by sum, apply tie-breaks
 *     - Take top N
 *     - Join with Player_Stats_PUBLIC for badge / level / profile fallback
 *
 *   period_max:
 *     - Same as period_summed but use Math.max instead of sum
 *
 *   match_top:
 *     - Filter Game_Data_Lookup by season window
 *     - Do not aggregate — keep per-match rows
 *     - Sort descending by metric, apply tie-breaks
 *     - Take top N
 *     - Profile pic and badge come straight from the row
 *     - Single player can appear multiple times for different matches
 *
 * The output is a unified ChallengeEntry shape regardless of source —
 * differences (presence of matchId, etc.) are nullable fields so the
 * rendering layer can adapt per challenge.
 */

import type { Challenge } from "@/lib/cms/challenges";
import type { Season } from "@/lib/cms/seasons";
import { getTiebreak, type TiebreakInput } from "@/lib/cms/tiebreaks";
import { fetchExcludedNicknames } from "@/lib/cms/excluded-players";
import {
  fetchPeriodRows,
  type PeriodRow,
} from "@/lib/leaderboards/period-shared";
import { isUnclaimedNickname } from "@/lib/leaderboards/unclaimed";
import {
  fetchGameDataRows,
  filterByMonths as filterGameDataByMonths,
  readNumeric as readGameDataNumeric,
  type GameDataRow,
} from "@/lib/game-data/lookup";
import {
  fetchAllPlayerStats,
  type PlayerStatsRaw,
} from "@/lib/player-stats/shared";
import { parseNumericOr } from "@/lib/sheets";

/**
 * One row in a challenge's leaderboard table. Most fields are populated;
 * a few are conditional based on the source mode.
 */
export type ChallengeEntry = {
  /** 1-indexed display rank within the challenge. */
  rank: number;
  nickname: string;
  profilePicUrl: string;
  /** Player's rank/level badge URL. May be empty. */
  rankBadgeUrl: string;
  /** Player's level number, e.g. 8. May be 0 if unknown. */
  level: number;
  /** The primary metric value as displayed (e.g. summed XP, raw kill count). */
  metricValue: number;
  /** Human label for the metric (e.g. "Total XP", "Kills"). Filled by render layer or here from challenge. */
  matchId?: string;
  /**
   * Whether this row falls within the prize-cutoff. Used by the render
   * layer to apply a "winner" visual treatment to the top N.
   */
  isPrizeWinning: boolean;
};

/**
 * The complete dataset for a challenge — challenge config + ranked
 * entries. This is what the rendering layer consumes.
 */
export type ChallengeWithEntries = {
  challenge: Challenge;
  entries: ChallengeEntry[];
};

/**
 * Compute the ranked entries for every challenge in a season.
 * Each fetch is cached server-side; in practice this is one or two
 * unique fetches even when called for multiple challenges, because
 * Next.js de-dupes the underlying fetch calls.
 */
export async function fetchSeasonChallenges(
  season: Season,
  challenges: Challenge[],
): Promise<ChallengeWithEntries[]> {
  // Fetch everything we might need up-front. Period stats and game data
  // are independent fetches; player stats is needed to enrich some
  // challenges with badge/level info; excluded nicknames is the
  // prize-ineligible filter applied before ranking so excluded players
  // don't take a top-N slot from someone who'd otherwise be there.
  const [periodResult, gameDataResult, playerStatsResult, excludedNicknames] =
    await Promise.all([
      fetchPeriodRows(),
      fetchGameDataRows(),
      fetchAllPlayerStats(),
      fetchExcludedNicknames(),
    ]);

  // Build a quick nickname → player stats map for joins. Nicknames are
  // matched case-insensitively (consistent with the existing summary
  // search behaviour).
  const playerStatsByNickname = new Map<string, PlayerStatsRaw>();
  if (playerStatsResult.ok) {
    for (const p of playerStatsResult.rows) {
      const key = p.Player_Stats_Nickname.trim().toLowerCase();
      if (key !== "") playerStatsByNickname.set(key, p);
    }
  }

  const out: ChallengeWithEntries[] = [];
  for (const challenge of challenges) {
    let entries: ChallengeEntry[] = [];

    if (challenge.sourceMode === "period_summed" || challenge.sourceMode === "period_max") {
      if (periodResult.ok) {
        entries = computePeriodAggregatedEntries(
          challenge,
          season,
          periodResult.rows,
          playerStatsByNickname,
          excludedNicknames,
        );
      }
    } else if (challenge.sourceMode === "match_top") {
      if (gameDataResult.ok) {
        entries = computeMatchTopEntries(
          challenge,
          season,
          gameDataResult.rows,
          playerStatsByNickname,
          excludedNicknames,
        );
      }
    } else if (challenge.sourceMode === "gun_threshold_count") {
      if (gameDataResult.ok) {
        entries = computeGunThresholdCountEntries(
          challenge,
          season,
          gameDataResult.rows,
          playerStatsByNickname,
          excludedNicknames,
        );
      }
    }

    out.push({ challenge, entries });
  }

  return out;
}

/* ---------- Period-aggregated computation ---------- */

/**
 * Group all period rows for a player across the season window, applying
 * sum or max aggregation. Returns ranked + tie-broken + top-N entries.
 */
function computePeriodAggregatedEntries(
  challenge: Challenge,
  season: Season,
  periodRows: PeriodRow[],
  playerStatsByNickname: Map<string, PlayerStatsRaw>,
  excludedNicknames: Set<string>,
): ChallengeEntry[] {
  const monthSet = new Set(season.monthsInWindow);
  const isMaxMode = challenge.sourceMode === "period_max";

  // Group rows by nickname (lowercased for case-insensitive matching).
  // We aggregate the primary metric AND a handful of secondary metrics
  // useful for tie-breaking in the same pass.
  // Excluded players are filtered out at the per-row level so they
  // never enter the aggregate map. This is correct (excluded players
  // are absent from the leaderboard, period) AND avoids wasted work.
  type Aggregate = {
    nickname: string;
    profilePicUrl: string;
    primaryMetric: number;
    rowCount: number;
    seasonRoundsWon: number;
    seasonRoundsLost: number;
    seasonMatchesWon: number;
    seasonMatchesPlayed: number;
    seasonKills: number;
    seasonDeaths: number;
    seasonScore: number;
  };

  const aggregates = new Map<string, Aggregate>();

  for (const row of periodRows) {
    if (!monthSet.has(row.yearMonth)) continue;

    const key = row.nickname.toLowerCase();
    if (excludedNicknames.has(key)) continue;

    const existing = aggregates.get(key);

    const primary = parseNumericOr(row.raw[challenge.metric], 0);
    // Period stats column names — verified from existing leaderboard code:
    //   Rounds_Won, Rounds_Lost — for round win rate tie-break
    //   Matches_Won, Matches_Played — for matches-played gating + tie-breaks
    //   Total_Points — for points-based tie-break
    // Kills/Deaths/Score totals may or may not exist in the period sheet;
    // we read them defensively (parseNumericOr defaults to 0) so any
    // future tie-break that needs them won't crash if the column is
    // absent — it'll just always evaluate to 0 and fall through.
    const roundsWon = parseNumericOr(row.raw.Rounds_Won, 0);
    const roundsLost = parseNumericOr(row.raw.Rounds_Lost, 0);
    const matchesWon = parseNumericOr(row.raw.Matches_Won, 0);
    const matchesPlayed = parseNumericOr(row.raw.Matches_Played, 0);
    const kills = parseNumericOr(row.raw.Total_Kills, 0);
    const deaths = parseNumericOr(row.raw.Total_Deaths, 0);
    const score = parseNumericOr(row.raw.Total_Points, 0);

    if (!existing) {
      aggregates.set(key, {
        nickname: row.nickname,
        profilePicUrl: row.profilePicUrl,
        primaryMetric: primary,
        rowCount: 1,
        seasonRoundsWon: roundsWon,
        seasonRoundsLost: roundsLost,
        seasonMatchesWon: matchesWon,
        seasonMatchesPlayed: matchesPlayed,
        seasonKills: kills,
        seasonDeaths: deaths,
        seasonScore: score,
      });
    } else {
      existing.primaryMetric = isMaxMode
        ? Math.max(existing.primaryMetric, primary)
        : existing.primaryMetric + primary;
      existing.rowCount += 1;
      // Secondary metrics are always summed across the window — they
      // exist to support tie-breaks like "highest win rate this season",
      // which is inherently a season-wide ratio regardless of whether
      // the primary is summed or maxed.
      existing.seasonRoundsWon += roundsWon;
      existing.seasonRoundsLost += roundsLost;
      existing.seasonMatchesWon += matchesWon;
      existing.seasonMatchesPlayed += matchesPlayed;
      existing.seasonKills += kills;
      existing.seasonDeaths += deaths;
      existing.seasonScore += score;
    }
  }

  // Build comparable items with their tie-break inputs prepared.
  type Comparable = {
    aggregate: Aggregate;
    tiebreakInput: TiebreakInput;
  };

  const comparables: Comparable[] = [];
  for (const agg of aggregates.values()) {
    if (agg.primaryMetric <= 0) continue; // skip players with no activity in this metric

    comparables.push({
      aggregate: agg,
      tiebreakInput: {
        primaryMetric: agg.primaryMetric,
        seasonRoundsWon: agg.seasonRoundsWon,
        seasonRoundsLost: agg.seasonRoundsLost,
        seasonMatchesWon: agg.seasonMatchesWon,
        seasonMatchesPlayed: agg.seasonMatchesPlayed,
        seasonKills: agg.seasonKills,
        seasonDeaths: agg.seasonDeaths,
        seasonScore: agg.seasonScore,
      },
    });
  }

  // Sort by primary metric descending, then by tiebreak1, then tiebreak2.
  // Each tiebreak is the named function from the registry; we call
  // it for each row at compare time. Rows where the tiebreak returns
  // 0 fall through to the next.
  const tb1 = getTiebreak(challenge.tiebreak1);
  const tb2 = getTiebreak(challenge.tiebreak2);

  comparables.sort((a, b) => {
    if (b.aggregate.primaryMetric !== a.aggregate.primaryMetric) {
      return b.aggregate.primaryMetric - a.aggregate.primaryMetric;
    }
    if (tb1) {
      const va = tb1(a.tiebreakInput);
      const vb = tb1(b.tiebreakInput);
      if (vb !== va) return vb - va;
    }
    if (tb2) {
      const va = tb2(a.tiebreakInput);
      const vb = tb2(b.tiebreakInput);
      if (vb !== va) return vb - va;
    }
    return 0;
  });

  // Take top N, enrich with player_stats lookup for badge + level.
  const topComparables = comparables.slice(0, challenge.topN);
  return topComparables.map((c, idx) => {
    const playerStats = playerStatsByNickname.get(c.aggregate.nickname.toLowerCase());
    const rankBadgeUrl = playerStats?.XP_Current_Rank_Badge_URL?.trim() ?? "";
    const level = parseNumericOr(playerStats?.XP_Current_Level ?? "", 0);
    // Prefer the player_stats profile pic if the period row didn't have one,
    // else use what we have.
    const profilePicFromStats = playerStats?.Player_Stats_Profile_Pic?.trim();
    const profilePicUrl =
      profilePicFromStats && profilePicFromStats !== ""
        ? profilePicFromStats
        : c.aggregate.profilePicUrl;

    return {
      rank: idx + 1,
      nickname: c.aggregate.nickname,
      profilePicUrl,
      rankBadgeUrl,
      level,
      metricValue: c.aggregate.primaryMetric,
      isPrizeWinning: idx + 1 <= challenge.prizeCutoff,
    };
  });
}

/* ---------- Match-top computation ---------- */

/**
 * Filter game data rows to season window, sort by metric, take top N.
 * No aggregation — single player can appear multiple times (different
 * matches).
 */
function computeMatchTopEntries(
  challenge: Challenge,
  season: Season,
  gameRows: GameDataRow[],
  playerStatsByNickname: Map<string, PlayerStatsRaw>,
  excludedNicknames: Set<string>,
): ChallengeEntry[] {
  const filtered = filterGameDataByMonths(gameRows, season.monthsInWindow);

  // Build comparables. Each row is independent — its tie-break inputs
  // come from the row's own match-level fields.
  // Exclude prize-ineligible players up-front, before sorting, so they
  // don't take a top-N slot. Note: "match_top" can show the SAME player
  // multiple times for different matches; excluding by nickname removes
  // ALL their match performances from the table, which is the right
  // semantic — they're ineligible across the board.
  type Comparable = {
    row: GameDataRow;
    primaryMetric: number;
    tiebreakInput: TiebreakInput;
  };

  const comparables: Comparable[] = filtered
    .filter(
      (row) =>
        !excludedNicknames.has(row.nickname.toLowerCase()) &&
        !isUnclaimedNickname(row.nickname),
    )
    .map((row) => {
      const primary = readGameDataNumeric(row, challenge.metric);
      const matchKills = readGameDataNumeric(row, "PlayerFragsCount");
      const matchDeaths = readGameDataNumeric(row, "PlayerDeathsCount");
      return {
        row,
        primaryMetric: primary,
        tiebreakInput: {
          primaryMetric: primary,
          matchKills,
          matchDeaths,
        },
      };
    })
    .filter((c) => c.primaryMetric > 0);

  const tb1 = getTiebreak(challenge.tiebreak1);
  const tb2 = getTiebreak(challenge.tiebreak2);

  comparables.sort((a, b) => {
    if (b.primaryMetric !== a.primaryMetric) {
      return b.primaryMetric - a.primaryMetric;
    }
    if (tb1) {
      const va = tb1(a.tiebreakInput);
      const vb = tb1(b.tiebreakInput);
      if (vb !== va) return vb - va;
    }
    if (tb2) {
      const va = tb2(a.tiebreakInput);
      const vb = tb2(b.tiebreakInput);
      if (vb !== va) return vb - va;
    }
    return 0;
  });

  // Mark the void parameter to keep TS strict happy.
  void season;

  // One place per player: keep only each player's single best match. The
  // list is already sorted best-first (metric desc + tie-breaks), so the
  // first row seen for a nickname is that player's best — drop the rest.
  const seenNicknames = new Set<string>();
  const deduped = comparables.filter((c) => {
    const key = c.row.nickname.toLowerCase();
    if (seenNicknames.has(key)) return false;
    seenNicknames.add(key);
    return true;
  });

  const top = deduped.slice(0, challenge.topN);
  return top.map((c, idx) => {
    // Try to enrich with player_stats first (latest profile pic / level),
    // fall back to the per-match row's own values if not found.
    const playerStats = playerStatsByNickname.get(c.row.nickname.toLowerCase());
    const profilePicFromStats = playerStats?.Player_Stats_Profile_Pic?.trim();
    const profilePicUrl =
      profilePicFromStats && profilePicFromStats !== ""
        ? profilePicFromStats
        : c.row.profilePicUrl;

    const rankBadgeUrl =
      playerStats?.XP_Current_Rank_Badge_URL?.trim() ?? c.row.rankBadgeUrl;
    const level = parseNumericOr(playerStats?.XP_Current_Level ?? "", 0);

    return {
      rank: idx + 1,
      nickname: c.row.nickname,
      profilePicUrl,
      rankBadgeUrl,
      level,
      metricValue: c.primaryMetric,
      matchId: c.row.matchId,
      isPrizeWinning: idx + 1 <= challenge.prizeCutoff,
    };
  });
}

/* ---------- Gun-threshold-count computation ---------- */

/**
 * "Most distinct guns with >= Threshold kills this season."
 *
 * Game_Data_Lookup has exactly one row per player per match, each row
 * recording the single gun used. So a player's season kills with a gun =
 * the sum of their match kills (PlayerFragsCount) over the matches where
 * that gun was used. We count how many distinct guns clear the threshold
 * and rank players by that count. The "Unknown Gun" placeholder and blank
 * gun cells are not counted as real guns.
 *
 * Secondary season aggregates (rounds/matches/kills/score) are summed in
 * the same pass so the named tie-breaks (e.g. round_win_rate_descending)
 * work. Final fallback when still tied: more total season kills wins.
 */
function computeGunThresholdCountEntries(
  challenge: Challenge,
  season: Season,
  gameRows: GameDataRow[],
  playerStatsByNickname: Map<string, PlayerStatsRaw>,
  excludedNicknames: Set<string>,
): ChallengeEntry[] {
  const filtered = filterGameDataByMonths(gameRows, season.monthsInWindow);
  const threshold = challenge.threshold > 0 ? challenge.threshold : 1;

  type Aggregate = {
    nickname: string;
    profilePicUrl: string;
    killsByGun: Map<string, number>;
    seasonRoundsWon: number;
    seasonRoundsLost: number;
    seasonMatchesWon: number;
    seasonMatchesPlayed: number;
    seasonKills: number;
    seasonDeaths: number;
    seasonScore: number;
  };

  const aggregates = new Map<string, Aggregate>();

  for (const row of filtered) {
    const key = row.nickname.toLowerCase();
    if (excludedNicknames.has(key) || isUnclaimedNickname(row.nickname)) continue;

    let agg = aggregates.get(key);
    if (!agg) {
      agg = {
        nickname: row.nickname,
        profilePicUrl: row.profilePicUrl,
        killsByGun: new Map(),
        seasonRoundsWon: 0,
        seasonRoundsLost: 0,
        seasonMatchesWon: 0,
        seasonMatchesPlayed: 0,
        seasonKills: 0,
        seasonDeaths: 0,
        seasonScore: 0,
      };
      aggregates.set(key, agg);
    }

    const gun = (row.raw.LaserOps_Gun_Used ?? "").trim().toLowerCase();
    const kills = readGameDataNumeric(row, "PlayerFragsCount");
    if (gun !== "" && gun !== "unknown gun") {
      agg.killsByGun.set(gun, (agg.killsByGun.get(gun) ?? 0) + kills);
    }

    agg.seasonRoundsWon += readGameDataNumeric(row, "LaserOps_Rounds_Won");
    agg.seasonRoundsLost += readGameDataNumeric(row, "LaserOps_Rounds_Lost");
    agg.seasonMatchesWon +=
      readGameDataNumeric(row, "LaserOps_Team_Is_Winner") === 1 ? 1 : 0;
    agg.seasonMatchesPlayed += 1;
    agg.seasonKills += kills;
    agg.seasonDeaths += readGameDataNumeric(row, "PlayerDeathsCount");
    agg.seasonScore += readGameDataNumeric(row, "LaserOps_Score");
  }

  type Comparable = {
    aggregate: Aggregate;
    count: number;
    tiebreakInput: TiebreakInput;
  };

  const comparables: Comparable[] = [];
  for (const agg of aggregates.values()) {
    let count = 0;
    for (const k of agg.killsByGun.values()) {
      if (k >= threshold) count += 1;
    }
    if (count <= 0) continue;
    comparables.push({
      aggregate: agg,
      count,
      tiebreakInput: {
        primaryMetric: count,
        seasonRoundsWon: agg.seasonRoundsWon,
        seasonRoundsLost: agg.seasonRoundsLost,
        seasonMatchesWon: agg.seasonMatchesWon,
        seasonMatchesPlayed: agg.seasonMatchesPlayed,
        seasonKills: agg.seasonKills,
        seasonDeaths: agg.seasonDeaths,
        seasonScore: agg.seasonScore,
      },
    });
  }

  const tb1 = getTiebreak(challenge.tiebreak1);
  const tb2 = getTiebreak(challenge.tiebreak2);

  comparables.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (tb1) {
      const va = tb1(a.tiebreakInput);
      const vb = tb1(b.tiebreakInput);
      if (vb !== va) return vb - va;
    }
    if (tb2) {
      const va = tb2(a.tiebreakInput);
      const vb = tb2(b.tiebreakInput);
      if (vb !== va) return vb - va;
    }
    // Natural fallback: more total season kills wins.
    return b.aggregate.seasonKills - a.aggregate.seasonKills;
  });

  return comparables.slice(0, challenge.topN).map((c, idx) => {
    const playerStats = playerStatsByNickname.get(
      c.aggregate.nickname.toLowerCase(),
    );
    const rankBadgeUrl = playerStats?.XP_Current_Rank_Badge_URL?.trim() ?? "";
    const level = parseNumericOr(playerStats?.XP_Current_Level ?? "", 0);
    const profilePicFromStats = playerStats?.Player_Stats_Profile_Pic?.trim();
    const profilePicUrl =
      profilePicFromStats && profilePicFromStats !== ""
        ? profilePicFromStats
        : c.aggregate.profilePicUrl;

    return {
      rank: idx + 1,
      nickname: c.aggregate.nickname,
      profilePicUrl,
      rankBadgeUrl,
      level,
      metricValue: c.count,
      isPrizeWinning: idx + 1 <= challenge.prizeCutoff,
    };
  });
}
