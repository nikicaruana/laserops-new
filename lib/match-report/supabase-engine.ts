/**
 * lib/match-report/supabase-engine.ts
 * --------------------------------------------------------------------
 * Supabase-backed Match Report. Produces the SAME MatchReport shape as the
 * Sheets engine (lib/match-report/engine.ts) from matches +
 * match_player_aggregate (+ config joins + match_awards), so the Match Report
 * and Last Match pages render unchanged. All XP-card fields are read straight
 * from the now-migrated aggregate columns – no recomputation.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameInfo } from "@/lib/cms/game-id-map";
import { type Accolade, accoladeKey } from "@/lib/cms/accolades";
import type { RankLevel } from "@/lib/cms/ranking-system";
import type {
  MatchPlayer,
  EarnedAccolade,
  MatchReport,
  MatchReportResult,
} from "@/lib/match-report/engine";
import type { GameDataRow, GameDataRaw } from "@/lib/game-data/lookup";
import { DEFAULT_AVATAR_URL } from "@/lib/avatar";
import { ladderDisplayName } from "@/lib/ladders";
const n = (v: number | null | undefined) => v ?? 0;

/** 1-based rank of v among vals (higher is better by default). */
const rankOf = (vals: number[], v: number, higher = true) => 1 + vals.filter((x) => (higher ? x > v : x < v)).length;

type StoredStreak = { key: string; count: number; points: number };
type StoredNemesis = { headband?: string; nickname: string; profilePicUrl: string | null; level: number; killsFor: number; killsAgainst: number } | null;
type StoredTally = { headband?: string; nickname: string; count: number };

type AggRow = {
  account_id: string | null;
  nickname: string | null;
  headset_label: string | null;
  team_colour: string | null;
  gun_used: string | null;
  profile_pic_url: string | null;
  frags: number | null;
  deaths: number | null;
  captures: number | null;
  hold_seconds: number | null;
  streaks: StoredStreak[] | null;
  nemesis: StoredNemesis;
  killed: StoredTally[] | null;
  killed_by: StoredTally[] | null;
  accuracy: number | null;
  kd: number | null;
  damage: number | null;
  spawn_kills: number | null;
  spawn_damage: number | null;
  score: number | null;
  match_rating: number | null;
  match_average_score: number | null;
  score_performance_delta: number | null;
  score_rank: number | null;
  kills_rank: number | null;
  deaths_rank: number | null;
  kd_rank: number | null;
  accuracy_rank: number | null;
  damage_rank: number | null;
  was_winner: boolean | null;
  rounds_won: number | null;
  rounds_lost: number | null;
  xp_from_points: number | null;
  xp_from_wins: number | null;
  xp_from_accolades: number | null;
  xp_total: number | null;
  level_before: number | null;
  level_after: number | null;
  xp_total_before_match: number | null;
  xp_total_after_match: number | null;
  xp_level_min_before_match: number | null;
  xp_next_level_min_before_match: number | null;
  xp_level_progress_start: number | null;
  xp_level_progress_end: number | null;
  xp_level_up_in_match: boolean | null;
};

type Summary = {
  round_wins?: { Red?: number; Blue?: number; Yellow?: number };
  team_ratings?: { Red?: number; Blue?: number; Yellow?: number };
  winning_team?: string | null;
  losing_team?: string | null;
  winning_rounds?: number | null;
  losing_rounds?: number | null;
};

/** The player's most recent match code (latest by date, then code). */
export async function getPlayerLastMatchId(
  supabase: SupabaseClient,
  opsTag: string,
): Promise<string | null> {
  const { data: life } = await supabase
    .from("player_stats_lifetime")
    .select("account_id")
    .ilike("nickname", opsTag.trim())
    .maybeSingle<{ account_id: string }>();
  if (!life) return null;

  const { data } = await supabase
    .from("match_player_aggregate")
    .select("matches!inner(match_code, played_on)")
    .eq("account_id", life.account_id);

  const rows = (data ?? []) as unknown as { matches: { match_code: string; played_on: string | null } | null }[];
  const matches = rows.map((r) => r.matches).filter((m): m is { match_code: string; played_on: string | null } => !!m);
  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    const pa = a.played_on ?? "";
    const pb = b.played_on ?? "";
    if (pa !== pb) return pb.localeCompare(pa);
    return b.match_code.localeCompare(a.match_code, "en", { numeric: true });
  });
  return matches[0].match_code;
}

/** All match codes (newest first) for the match-ID search autocomplete. */
export async function listAllMatchIdsSupabase(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase.from("matches").select("match_code").order("match_code", { ascending: false });
  return ((data ?? []) as { match_code: string }[]).map((m) => m.match_code).filter(Boolean);
}

export async function fetchMatchReportSupabase(
  supabase: SupabaseClient,
  matchId: string,
): Promise<MatchReportResult> {
  const { data: match } = await supabase
    .from("matches")
    .select("id, match_code, year, sequence_no, source_game_id, is_private, is_double_xp, winning_team_colour, net_result_summary, played_on, ladder_id, home_squad_id, away_squad_id, home_squad_colour, away_squad_colour, scoring_mode")
    .eq("match_code", matchId)
    .maybeSingle<{
      id: string;
      match_code: string;
      year: number | null;
      sequence_no: number | null;
      source_game_id: string | null;
      is_private: boolean | null;
      is_double_xp: boolean | null;
      winning_team_colour: string | null;
      net_result_summary: Summary | null;
      played_on: string | null;
      ladder_id: string | null;
      home_squad_id: string | null;
      away_squad_id: string | null;
      home_squad_colour: string | null;
      away_squad_colour: string | null;
      scoring_mode: string | null;
    }>();

  if (!match) return { ok: false, reason: "match-not-found" };

  const [{ data: aggs }, { data: awards }, { data: defs }, { data: ranks }, { data: guns }, { data: teams }, { data: streakDefs }] =
    await Promise.all([
      supabase.from("match_player_aggregate").select("*").eq("match_id", match.id),
      supabase.from("match_awards").select("headset_label, accolade_definition_id").eq("match_id", match.id),
      supabase.from("accolade_definitions").select("id, name, description, badge_url, xp"),
      supabase.from("rank_levels").select("level, rank_name, score_threshold, est_games, badge_url").order("level"),
      supabase.from("guns").select("name, image_url"),
      supabase.from("teams").select("colour, badge_url"),
      supabase.from("streak_definitions").select("streak_key, name, description, badge_url"),
    ]);

  const streakByKey = new Map(((streakDefs ?? []) as { streak_key: string; name: string | null; description: string | null; badge_url: string | null }[])
    .map((d) => [d.streak_key, d]));

  const rows = (aggs ?? []) as unknown as AggRow[];
  if (rows.length === 0) return { ok: false, reason: "no-players" };

  const rankRows = (ranks ?? []) as { level: number; rank_name: string | null; score_threshold: number | null; est_games: number | null; badge_url: string | null }[];
  const rankBadge = new Map(rankRows.map((r) => [r.level, r.badge_url ?? ""]));
  const ranksList: RankLevel[] = rankRows.map((r) => ({
    level: r.level,
    rankName: r.rank_name ?? "",
    scoreThreshold: r.score_threshold ?? 0,
    estGames: r.est_games ?? 0,
    badgeUrl: r.badge_url ?? "",
  }));
  const gunImage = new Map(((guns ?? []) as { name: string; image_url: string | null }[]).map((g) => [g.name, g.image_url ?? ""]));
  const teamBadge = new Map(((teams ?? []) as { colour: string; badge_url: string | null }[]).map((t) => [t.colour.toLowerCase(), t.badge_url ?? ""]));

  // Accolade metadata by definition id.
  const accById = new Map(
    ((defs ?? []) as { id: string; name: string; description: string | null; badge_url: string | null; xp: number | null }[]).map(
      (d): [string, Accolade] => [d.id, { name: d.name, key: accoladeKey(d.name), description: d.description ?? "", badgeUrl: d.badge_url ?? "", xp: d.xp ?? 0 }],
    ),
  );
  // Earned accolades per player (by headset_label).
  const earnedByHeadset = new Map<string, EarnedAccolade[]>();
  for (const a of (awards ?? []) as { headset_label: string | null; accolade_definition_id: string }[]) {
    const key = a.headset_label ?? "";
    const acc = accById.get(a.accolade_definition_id);
    if (!acc) continue;
    const list = earnedByHeadset.get(key) ?? [];
    list.push({ accolade: acc });
    earnedByHeadset.set(key, list);
  }

  const players: MatchPlayer[] = rows.map((r) => {
    const nickname = r.nickname ?? "";
    const teamColor = r.team_colour ?? "";
    const profilePicUrl = r.profile_pic_url || DEFAULT_AVATAR_URL;
    const row: GameDataRow = {
      nickname,
      profilePicUrl,
      yearMonth: match.played_on ? match.played_on.slice(0, 7) : "",
      matchId: match.match_code,
      rankBadgeUrl: rankBadge.get(n(r.level_before)) ?? "",
      raw: {} as GameDataRaw, // components don't read the raw escape hatch
    };
    return {
      row,
      nickname,
      profilePicUrl,
      teamColor,
      teamColorLower: teamColor.toLowerCase(),
      level: n(r.level_before),
      rankBadgeUrl: rankBadge.get(n(r.level_before)) ?? "",
      score: n(r.score),
      kills: n(r.frags),
      deaths: n(r.deaths),
      kd: n(r.kd),
      accuracy: n(r.accuracy),
      damage: n(r.damage),
      spawnKills: n(r.spawn_kills),
      spawnDamage: n(r.spawn_damage),
      totalXp: n(r.xp_total),
      gunUsed: r.gun_used ?? "",
      gunUsedImage: r.gun_used ? gunImage.get(r.gun_used) ?? "" : "",
      scoreRank: n(r.score_rank),
      killsRank: n(r.kills_rank),
      deathsRank: n(r.deaths_rank),
      kdRank: n(r.kd_rank),
      accuracyRank: n(r.accuracy_rank),
      damageRank: n(r.damage_rank),
      matchRating: n(r.match_rating),
      averageMatchScore: n(r.match_average_score),
      scorePerformanceDelta: n(r.score_performance_delta),
      teamRoundsWon: n(r.rounds_won),
      teamRoundsLost: n(r.rounds_lost),
      isWinner: r.was_winner === true,
      teamBadgeImage: teamBadge.get(teamColor.toLowerCase()) ?? "",
      xpFromPoints: n(r.xp_from_points),
      xpFromWins: n(r.xp_from_wins),
      xpFromAccolades: n(r.xp_from_accolades),
      xpEarnedThisMatch: n(r.xp_total),
      xpTotalBeforeMatch: n(r.xp_total_before_match),
      xpTotalAfterMatch: n(r.xp_total_after_match),
      xpCurrentLevelBeforeMatch: n(r.level_before),
      xpCurrentLevelAfterMatch: n(r.level_after),
      xpCurrentLevelMinBeforeMatch: n(r.xp_level_min_before_match),
      xpNextLevelMinBeforeMatch: n(r.xp_next_level_min_before_match),
      xpLevelProgressStart: n(r.xp_level_progress_start),
      xpLevelProgressEnd: n(r.xp_level_progress_end),
      xpLevelUpInMatch: r.xp_level_up_in_match === true,
      xpLevelBadgeImage: rankBadge.get(n(r.level_after)) ?? "",
      earnedAccolades: earnedByHeadset.get(r.headset_label ?? "") ?? [],
      // Objective columns (Caps count + seconds held) from the ingestion commit.
      objCaps: n(r.captures),
      capTime: Math.round(n(r.hold_seconds)),
      // Rich detail persisted by the commit step (streaks, nemesis, kill lists).
      matchStreaks: (r.streaks ?? []).map((s) => {
        const def = streakByKey.get(s.key);
        return { key: s.key, name: def?.name ?? s.key, description: def?.description ?? "", badgeUrl: def?.badge_url ?? "", points: s.points, count: s.count };
      }),
      nemesis: r.nemesis
        ? { nickname: r.nemesis.nickname, profilePicUrl: r.nemesis.profilePicUrl || DEFAULT_AVATAR_URL, level: r.nemesis.level,
            killsFor: r.nemesis.killsFor, killsAgainst: r.nemesis.killsAgainst, damageFor: 0, damageAgainst: 0 }
        : null,
      killed: (r.killed ?? []).map((k) => ({ nickname: k.nickname, count: k.count })),
      killedBy: (r.killed_by ?? []).map((k) => ({ nickname: k.nickname, count: k.count })),
    };
  });

  // Objective-column ranks (Caps count + seconds held), computed here since the
  // aggregate doesn't store the ranks for these two columns.
  const capsVals = players.map((p) => p.objCaps ?? 0);
  const holdVals = players.map((p) => p.capTime ?? 0);
  for (const p of players) {
    p.objCapsRank = rankOf(capsVals, p.objCaps ?? 0);
    p.capTimeRank = rankOf(holdVals, p.capTime ?? 0);
  }

  players.sort((a, b) => b.score - a.score);

  // Squad-vs-squad context: colour -> squad {name, badge} + a match-kind label.
  let squadCtx: SquadCtx | null = null;
  if (match.home_squad_id && match.away_squad_id) {
    const [{ data: sqRows }, ladderRes] = await Promise.all([
      supabase.from("squads").select("id, name, badge_url").in("id", [match.home_squad_id, match.away_squad_id]),
      match.ladder_id
        ? supabase.from("ladders").select("key, sponsor_name").eq("id", match.ladder_id).maybeSingle()
        : Promise.resolve({ data: null as { key: string; sponsor_name: string | null } | null }),
    ]);
    const byId = new Map(((sqRows ?? []) as { id: string; name: string; badge_url: string | null }[]).map((s) => [s.id, s]));
    const byColour = new Map<string, { name: string; badgeUrl: string }>();
    const home = byId.get(match.home_squad_id);
    const away = byId.get(match.away_squad_id);
    if (home && match.home_squad_colour) byColour.set(match.home_squad_colour.toLowerCase(), { name: home.name, badgeUrl: home.badge_url ?? "" });
    if (away && match.away_squad_colour) byColour.set(match.away_squad_colour.toLowerCase(), { name: away.name, badgeUrl: away.badge_url ?? "" });
    const ladder = ladderRes.data as { key: string; sponsor_name: string | null } | null;
    squadCtx = {
      matchKind: match.ladder_id ? "ladder" : "squad",
      ladderName: ladder ? ladderDisplayName(ladder.key, ladder.sponsor_name) : null,
      byColour,
    };
  }

  const game = buildGameInfo(match, teamBadge, squadCtx);
  const report: MatchReport = { game, players, ranks: ranksList, matchDate: match.played_on ?? "" };
  return { ok: true, report };
}

type SquadCtx = {
  matchKind: "ladder" | "squad";
  ladderName: string | null;
  byColour: Map<string, { name: string; badgeUrl: string }>;
};

function buildGameInfo(
  match: {
    match_code: string;
    year: number | null;
    sequence_no: number | null;
    source_game_id: string | null;
    is_private: boolean | null;
    is_double_xp: boolean | null;
    winning_team_colour: string | null;
    net_result_summary: Summary | null;
    scoring_mode: string | null;
  },
  teamBadge: Map<string, string>,
  squadCtx: SquadCtx | null,
): GameInfo {
  const s = match.net_result_summary ?? {};
  const rw = s.round_wins ?? {};
  const tr = s.team_ratings ?? {};
  const winning = (s.winning_team ?? match.winning_team_colour ?? "").trim();
  const losing = (s.losing_team ?? "").trim();
  const wSquad = squadCtx?.byColour.get(winning.toLowerCase());
  const lSquad = squadCtx?.byColour.get(losing.toLowerCase());
  const ratingFor = (colour: string) => {
    const k = colour.charAt(0).toUpperCase() + colour.slice(1).toLowerCase();
    return (tr as Record<string, number | undefined>)[k] ?? 0;
  };
  return {
    matchId: match.match_code,
    rawGameId: match.source_game_id ?? "",
    gameStartTimeYear: match.year != null ? String(match.year) : "",
    gameNo: match.sequence_no != null ? String(match.sequence_no) : "",
    isPrivate: match.is_private === true,
    isDoubleXp: match.is_double_xp === true,
    offline: match.scoring_mode === "offline",
    teams: {
      red: { roundWins: rw.Red ?? 0, rating: tr.Red ?? 0 },
      blue: { roundWins: rw.Blue ?? 0, rating: tr.Blue ?? 0 },
      yellow: { roundWins: rw.Yellow ?? 0, rating: tr.Yellow ?? 0 },
    },
    winningTeam: winning,
    losingTeam: losing,
    winningTeamRounds: s.winning_rounds ?? 0,
    losingTeamRounds: s.losing_rounds ?? 0,
    winningTeamRating: ratingFor(winning),
    losingTeamRating: ratingFor(losing),
    winningTeamBadge: wSquad?.badgeUrl || teamBadge.get(winning.toLowerCase()) || "",
    losingTeamBadge: lSquad?.badgeUrl || teamBadge.get(losing.toLowerCase()) || "",
    matchKind: squadCtx?.matchKind ?? null,
    ladderName: squadCtx?.ladderName ?? null,
    winningTeamName: wSquad?.name ?? null,
    losingTeamName: lSquad?.name ?? null,
  };
}
