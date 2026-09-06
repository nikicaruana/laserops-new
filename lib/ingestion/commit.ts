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

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export type CommitStreak = { key: string; count: number; points: number };
export type CommitNemesis = { nickname: string; profilePicUrl: string | null; level: number; killsFor: number; killsAgainst: number } | null;
export type CommitTally = { nickname: string; count: number };

export type CommitAggregate = {
  account_id: string | null; nickname: string; headset_label: string; team_colour: string; profile_pic_url: string | null;
  frags: number; deaths: number; hits: number; shots: number; wounds: number; captures: number; hold_seconds: number;
  accuracy: number; kd: number; damage: number; score: number;
  score_rank: number; kills_rank: number; deaths_rank: number; kd_rank: number; accuracy_rank: number; damage_rank: number;
  was_winner: boolean; rounds_won: number; rounds_lost: number; team_score: number; opponent_team_score: number;
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
  rawRounds: { raw: string; resolutions?: RoundResolutions }[],
  accoladeByKey: Map<string, { id: string; xp: number }>,
  identity: (headband: string) => { nickname: string; accountId: string | null; profilePicUrl?: string | null },
  xp = { roundWin: 750, matchWin: 500 },
): CommitResult {
  const report = buildMatchReportV2(rawRounds, { matchId: "commit", label: "commit" });
  const P = report.players;
  const rankOf = (vals: number[], v: number, higher = true) => 1 + vals.filter((x) => (higher ? x > v : x < v)).length;
  const scores = P.map((p) => p.totalScore), kills = P.map((p) => p.frags), deaths = P.map((p) => p.deaths);
  const kds = P.map((p) => p.kd), accs = P.map((p) => p.accuracy), dmgs = P.map((p) => p.damage);
  const teamScore: Record<string, number> = {};
  for (const p of P) teamScore[p.team] = (teamScore[p.team] ?? 0) + p.totalScore;
  const winner = report.matchWinner;

  // Resolve an opponent's headband to their display name (for nemesis + kill lists).
  const nameFor = (headband: string) => identity(headband).nickname;

  const aggregates: CommitAggregate[] = P.map((p) => {
    const idn = identity(p.name);
    const teamRoundsWon = report.roundsWonByTeam[p.team] ?? 0;
    const isWinner = p.team === winner;
    const oppTeam = Object.keys(teamScore).find((t) => t !== p.team);
    const xpPoints = p.totalScore;
    const xpWins = xp.roundWin * teamRoundsWon + (isWinner ? xp.matchWin : 0);
    const xpAcc = p.accolades.reduce((s, nm) => s + (accoladeByKey.get(norm(nm))?.xp ?? 0), 0);
    const nemesis: CommitNemesis = p.nemesis
      ? { nickname: nameFor(p.nemesis.name), profilePicUrl: identity(p.nemesis.name).profilePicUrl ?? null, level: 0, killsFor: p.nemesis.killsFor, killsAgainst: p.nemesis.killsAgainst }
      : null;
    return {
      account_id: idn.accountId, nickname: idn.nickname, headset_label: p.name, team_colour: p.team, profile_pic_url: idn.profilePicUrl ?? null,
      frags: p.frags, deaths: p.deaths, hits: p.hits, shots: p.shots, wounds: p.wounds, captures: p.captures + p.recaptures, hold_seconds: Math.round(p.holdSeconds),
      accuracy: Math.round(p.accuracy * 10000) / 10000, kd: p.kd, damage: p.damage, score: p.totalScore,
      score_rank: rankOf(scores, p.totalScore), kills_rank: rankOf(kills, p.frags), deaths_rank: rankOf(deaths, p.deaths, false),
      kd_rank: rankOf(kds, p.kd), accuracy_rank: rankOf(accs, p.accuracy), damage_rank: rankOf(dmgs, p.damage),
      was_winner: isWinner, rounds_won: teamRoundsWon, rounds_lost: report.roundCount - teamRoundsWon,
      team_score: teamScore[p.team] ?? 0, opponent_team_score: oppTeam ? teamScore[oppTeam] ?? 0 : 0,
      xp_from_points: xpPoints, xp_from_wins: xpWins, xp_from_accolades: xpAcc, xp_total: xpPoints + xpWins + xpAcc,
      streaks: p.streaks.map((s) => ({ key: s.key, count: s.count, points: s.points })),
      nemesis,
      killed: p.killed.map((k) => ({ nickname: nameFor(k.name), count: k.count })),
      killed_by: p.killedBy.map((k) => ({ nickname: nameFor(k.name), count: k.count })),
    };
  });

  const awards: CommitAward[] = [];
  for (const p of P) {
    const idn = identity(p.name);
    for (const nm of p.accolades) {
      const a = accoladeByKey.get(norm(nm));
      if (!a) continue;
      awards.push({ account_id: idn.accountId, headset_label: p.name, nickname: idn.nickname, accolade_definition_id: a.id, xp_granted: a.xp });
    }
  }

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
