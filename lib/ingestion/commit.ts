/**
 * lib/ingestion/commit.ts
 * --------------------------------------------------------------------
 * Compute the COMMIT payload for a match — per-player aggregates + accolade
 * awards + XP — from the ingested rounds. Reuses buildMatchReportV2 so the
 * published numbers are IDENTICAL to the /match-report-v2 preview. Pure; the
 * route handler does auth + the DB writes.
 *
 * Phase 1: aggregates + accolades + XP (points + wins + accolades). ELO and
 * level progression are left for Phase 2 (those columns stay null).
 */
import { buildMatchReportV2 } from "../match-report-v2/build";
import type { RoundResolutions } from "./resolutions";
import { specialistWinners } from "./accolades";
import { computeMatchXp, DEFAULT_XP_CONFIG, type XpConfig } from "../scoring/xp";
import type { ScoringRuntime } from "../scoring/config";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export type CommitStreak = { key: string; count: number; points: number };
// `headband` is the raw headset label; the post-publish edit step re-resolves
// `nickname` from it when an opponent's identity changes.
export type CommitNemesis = { headband: string; nickname: string; profilePicUrl: string | null; level: number; killsFor: number; killsAgainst: number } | null;
export type CommitTally = { headband: string; nickname: string; count: number };

export type CommitAggregate = {
  account_id: string | null; nickname: string; headset_label: string; team_colour: string; profile_pic_url: string | null; gun_used: string | null;
  frags: number; deaths: number; hits: number; shots: number; wounds: number; spawn_kills: number; spawn_damage: number; captures: number; hold_seconds: number;
  accuracy: number; kd: number; damage: number; score: number; match_rating: number; match_average_score: number; score_performance_delta: number; xp_multiplier: number;
  score_rank: number; kills_rank: number; deaths_rank: number; kd_rank: number; accuracy_rank: number; damage_rank: number;
  was_winner: boolean; rounds_won: number; rounds_lost: number; rounds_played: number; rounds_won_present: number; team_score: number; opponent_team_score: number;
  xp_from_points: number; xp_from_wins: number; xp_from_accolades: number; xp_total: number;
  streaks: CommitStreak[]; nemesis: CommitNemesis; killed: CommitTally[]; killed_by: CommitTally[];
};
export type CommitAward = { account_id: string | null; headset_label: string; nickname: string; accolade_definition_id: string; xp_granted: number };

/** The match-level result summary, in the exact shape the Match Report reads
 *  (lib/match-report/supabase-engine.ts buildGameInfo). Colour keys are
 *  capitalised (Red/Blue/Yellow) to match the report's lookups. */
export type NetResultSummary = {
  round_wins: Record<string, number>;
  team_ratings: Record<string, number>;
  winning_team: string | null;
  losing_team: string | null;
  winning_rounds: number;
  losing_rounds: number;
};

export type CommitResult = {
  aggregates: CommitAggregate[]; awards: CommitAward[];
  winnerColour: string | null; losingColour: string | null;
  roundsWonByTeam: Record<string, number>; roundCount: number;
  netResultSummary: NetResultSummary;
};

export function computeMatchCommit(
  rawRounds: { raw: string; resolutions?: RoundResolutions; winnerOverride?: string | null }[],
  accoladeByKey: Map<string, { id: string; xp: number }>,
  identity: (headband: string) => { nickname: string; accountId: string | null; profilePicUrl?: string | null; gun?: string | null; xpMultiplier?: number },
  cfg: XpConfig = DEFAULT_XP_CONFIG,
  isDoubleXp = false,
  streakConfig?: Record<string, { name: string; points: number }>,
  scoringRuntime?: ScoringRuntime,
  /** Hybrid matches: offline rounds' kill stats (merged into kill totals; no
   *  objective/streaks) + their round winners. opsTagByHeadband names them so
   *  they merge with the matching online player. */
  offline?: {
    statsByHeadband: Record<number, { frags: number; deaths: number; hits: number; shots: number; damage: number; wounds?: number; team: string }>;
    roundWinners: (string | null)[];
    opsTagByHeadband?: Record<number, string>;
    excludeHeadbands?: number[];
  },
): CommitResult {
  const report = buildMatchReportV2(rawRounds, { matchId: "commit", label: "commit" }, { identityByHeadband: (hb) => { const e = identity(String(hb)); return e.nickname && e.nickname !== String(hb) ? e.nickname : ""; }, opsTagByHeadband: offline?.opsTagByHeadband, streakConfig, scoring: scoringRuntime?.scoring, formula: scoringRuntime?.formula, offline: offline ? { statsByHeadband: offline.statsByHeadband, roundWinners: offline.roundWinners } : undefined, excludeHeadbands: offline?.excludeHeadbands, });
  const P = report.players;
  const rankOf = (vals: number[], v: number, higher = true) => 1 + vals.filter((x) => (higher ? x > v : x < v)).length;
  const scores = P.map((p) => p.totalScore), kills = P.map((p) => p.frags), deaths = P.map((p) => p.deaths);
  const kds = P.map((p) => p.kd), accs = P.map((p) => p.accuracy), dmgs = P.map((p) => p.damage);
  const teamScore: Record<string, number> = {};
  for (const p of P) teamScore[p.team] = (teamScore[p.team] ?? 0) + p.totalScore;
  const winner = report.matchWinner;
  const matchAvg = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;

  // Resolve an opponent's headband to their display name (for nemesis + kill lists).
  const nameFor = (headband: string) => identity(headband).nickname;

  const specialistXp = accoladeByKey.get("specialist")?.xp ?? 0;
  const specialistIdx = new Set(
    specialistWinners(P.map((p, i) => ({ id: i, gun: identity(p.name).gun ?? null, score: p.totalScore, frags: p.frags, name: identity(p.name).nickname }))),
  );

  // Extrapolate each player's score to a FULL-match equivalent for the RATING
  // only (score x totalRounds / roundsPlayed), so playing fewer rounds doesn't drag
  // down match_rating + its lifetime/HoF rollups. Full-match players are unchanged.
  // Raw score / average / delta and performance XP stay on ACTUAL play.
  const R = report.roundCount;
  const ratingScores = P.map((p) => { const rp = p.roundsPlayed && p.roundsPlayed > 0 ? p.roundsPlayed : R; return rp > 0 ? (p.totalScore * R) / rp : p.totalScore; });
  const avgRatingScore = ratingScores.length ? ratingScores.reduce((s, v) => s + v, 0) / ratingScores.length : 0;
  const aggregates: CommitAggregate[] = P.map((p, i) => {
    const idn = identity(p.name);
    const teamRoundsWon = report.roundsWonByTeam[p.team] ?? 0;
    const isWinner = p.team === winner;
    const oppTeam = Object.keys(teamScore).find((t) => t !== p.team);
    // Effective XP multiplier: the bigger of the player's personal boost token
    // (double / 1.5x, spent at sign-in) and a match-wide Double XP night (2x).
    // They don't stack; a player gets whichever is larger.
    const mult = Math.max(idn.xpMultiplier ?? 1, isDoubleXp ? 2 : 1);
    const rating = matchAvg > 0 ? p.totalScore / matchAvg : 0;
    const accoladeBase = p.accolades.reduce((s, nm) => s + (accoladeByKey.get(norm(nm))?.xp ?? 0), 0) + (specialistIdx.has(i) ? specialistXp : 0);
    const xpb = computeMatchXp({ rating, roundsWon: p.roundsWonPresent ?? teamRoundsWon, isWinner, accoladeXp: accoladeBase, multiplier: mult }, cfg);
    const xpPoints = xpb.xpFromPoints, xpWins = xpb.xpFromWins, xpAcc = xpb.xpFromAccolades;
    const nemesis: CommitNemesis = p.nemesis
      ? { headband: p.nemesis.name, nickname: nameFor(p.nemesis.name), profilePicUrl: identity(p.nemesis.name).profilePicUrl ?? null, level: 0, killsFor: p.nemesis.killsFor, killsAgainst: p.nemesis.killsAgainst }
      : null;
    return {
      account_id: idn.accountId, nickname: idn.nickname, headset_label: p.name, team_colour: p.team, profile_pic_url: idn.profilePicUrl ?? null, gun_used: idn.gun ?? null,
      frags: p.frags, deaths: p.deaths, hits: p.hits, shots: p.shots, wounds: p.wounds, spawn_kills: p.spawnKills, spawn_damage: Math.round(p.spawnDamage), captures: p.captures + p.recaptures, hold_seconds: Math.round(p.holdSeconds),
      accuracy: Math.round(p.accuracy * 10000) / 10000, kd: p.kd, damage: p.damage, score: p.totalScore,
      match_rating: avgRatingScore > 0 ? Math.round((ratingScores[i] / avgRatingScore) * 100) / 100 : 0, match_average_score: Math.round(matchAvg), score_performance_delta: Math.round(p.totalScore - matchAvg), xp_multiplier: mult,
      score_rank: rankOf(scores, p.totalScore), kills_rank: rankOf(kills, p.frags), deaths_rank: rankOf(deaths, p.deaths, false),
      kd_rank: rankOf(kds, p.kd), accuracy_rank: rankOf(accs, p.accuracy), damage_rank: rankOf(dmgs, p.damage),
      was_winner: isWinner, rounds_won: teamRoundsWon, rounds_lost: report.roundCount - teamRoundsWon, rounds_played: p.roundsPlayed ?? R, rounds_won_present: p.roundsWonPresent ?? teamRoundsWon,
      team_score: teamScore[p.team] ?? 0, opponent_team_score: oppTeam ? teamScore[oppTeam] ?? 0 : 0,
      xp_from_points: xpPoints, xp_from_wins: xpWins, xp_from_accolades: xpAcc, xp_total: xpb.xpTotal,
      streaks: p.streaks.map((s) => ({ key: s.key, count: s.count, points: s.points })),
      nemesis,
      killed: p.killed.map((k) => ({ headband: k.name, nickname: nameFor(k.name), count: k.count })),
      killed_by: p.killedBy.map((k) => ({ headband: k.name, nickname: nameFor(k.name), count: k.count })),
    };
  });

  const awards: CommitAward[] = [];
  const specialistDef = accoladeByKey.get("specialist");
  P.forEach((p, i) => {
    const idn = identity(p.name);
    for (const nm of p.accolades) {
      const a = accoladeByKey.get(norm(nm));
      if (!a) continue;
      awards.push({ account_id: idn.accountId, headset_label: p.name, nickname: idn.nickname, accolade_definition_id: a.id, xp_granted: a.xp });
    }
    if (specialistDef && specialistIdx.has(i)) {
      awards.push({ account_id: idn.accountId, headset_label: p.name, nickname: idn.nickname, accolade_definition_id: specialistDef.id, xp_granted: specialistDef.xp });
    }
  });

  const loser = winner ? Object.keys(teamScore).find((t) => t !== winner) ?? null : null;
  const netResultSummary: NetResultSummary = {
    round_wins: { ...report.roundsWonByTeam },
    team_ratings: { ...teamScore },
    winning_team: winner,
    losing_team: loser,
    winning_rounds: winner ? report.roundsWonByTeam[winner] ?? 0 : 0,
    losing_rounds: loser ? report.roundsWonByTeam[loser] ?? 0 : 0,
  };

  return { aggregates, awards, winnerColour: winner, losingColour: loser, roundsWonByTeam: report.roundsWonByTeam, roundCount: report.roundCount, netResultSummary };
}
