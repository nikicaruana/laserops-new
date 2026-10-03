/**
 * lib/ingestion/offline-commit.ts
 * --------------------------------------------------------------------
 * Score an OFFLINE match from a single .lwa export (one file = the whole match,
 * pre-aggregated, no per-event timeline). Produces the SAME CommitResult shape
 * as computeMatchCommit so publish / recompute / the report treat online and
 * offline games identically downstream.
 *
 * Differences from the online path (dictated by what offline data exists):
 *  - Score = killScore ONLY. objectiveScore = 0 (captures always 0 offline, no
 *    hold-time) and streakScore = 0 (no event timeline).
 *  - `damage` is RECONSTRUCTED as hits x per-gun damage (offline files carry no
 *    applied-damage figure and no gun), resolved per headband via `gunDamage`.
 *  - Round winners aren't in the file, so they're passed in (marshal-entered);
 *    the match winner is the team that won the most rounds.
 *  - Multiple headbands that resolve to the SAME account are MERGED into one
 *    player: raw counters summed, damage summed per-headband, then accuracy /
 *    K/D / killScore recomputed ONCE from the merged totals (killScore is
 *    non-linear, so we must sum raw before scoring). Account-less walk-ins stay
 *    individual.
 *
 * Event-only fields (streaks, nemesis, killed/killed_by, captures, hold) are
 * empty/zero on offline aggregates; the report shows them as "not captured".
 */
import { computeMatchXp, DEFAULT_XP_CONFIG, type XpConfig } from "../scoring/xp";
import { computeGroupValue, type ScoreFormula } from "../scoring/formula";
import type { CommitAggregate, CommitAward, CommitResult, NetResultSummary } from "./commit";
import { computeAccolades, specialistWinners, type AccoladeStat } from "./accolades";

export type OfflinePlayerStat = {
  headband: string; // e.g. "Head 10" or "10"
  team: string; // colour (Blue/Red/Yellow…)
  frags: number; deaths: number; hits: number; shots: number; wounds: number; revivals: number;
};
export type OfflineRoundResult = { winnerColour: string | null };

type Identity = (headband: string) => {
  nickname: string; accountId: string | null; profilePicUrl?: string | null; gun?: string | null; xpMultiplier?: number;
};
/** Damage-per-hit for a gun (resolved at the game's date by the caller); the
 *  Unknown-Gun fallback is applied by the caller for a null/unknown gun. */
type GunDamage = (gunName: string | null | undefined) => number;

/** Same kill-score model as the online v2 formula (build.ts); objective +
 *  streak components are 0 offline. */
function killScoreOf(frags: number, damage: number, accuracy: number, kd: number, formula?: ScoreFormula): number {
  if (formula) {
    // Offline = kill-only: sum just the non-objective groups of the admin formula.
    let killV = 0;
    for (const g of formula.groups) {
      const isObj = [...g.baseTerms, ...g.multipliers].some((t) => t.stat === "captures" || t.stat === "hold" || t.stat === "recaptures");
      if (!isObj) killV += computeGroupValue(g, { frags, damage, accuracy, kd });
    }
    return Math.round(killV);
  }
  return Math.round((frags * 50 + damage * 0.2) * (1 + accuracy * 0.2) * (1 + kd * 0.12));
}

type Group = {
  accountId: string | null;
  primaryHeadband: string; // highest-frag headband — the display + identity anchor
  team: string; // team of the primary headband
  bestFrags: number;
  frags: number; deaths: number; hits: number; shots: number; wounds: number; revivals: number; damage: number;
};

export function computeOfflineMatchCommit(
  players: OfflinePlayerStat[],
  roundResults: OfflineRoundResult[],
  identity: Identity,
  gunDamage: GunDamage,
  cfg: XpConfig = DEFAULT_XP_CONFIG,
  isDoubleXp = false,
  formula?: ScoreFormula,
  accoladeByKey?: Map<string, { id: string; xp: number }>,
): CommitResult {
  // --- 1. Merge headbands that resolve to the same account -----------------
  const groups = new Map<string, Group>();
  for (const p of players) {
    const idn = identity(p.headband);
    const hbNum = p.headband.match(/\d+/)?.[0] ?? p.headband;
    const key = idn.accountId ? `acct:${idn.accountId}` : `hb:${hbNum}`;
    let g = groups.get(key);
    if (!g) {
      g = { accountId: idn.accountId, primaryHeadband: p.headband, team: p.team, bestFrags: -1,
        frags: 0, deaths: 0, hits: 0, shots: 0, wounds: 0, revivals: 0, damage: 0 };
      groups.set(key, g);
    }
    g.frags += p.frags; g.deaths += p.deaths; g.hits += p.hits; g.shots += p.shots;
    g.wounds += p.wounds; g.revivals += p.revivals;
    g.damage += p.hits * gunDamage(idn.gun);
    // Anchor identity + team to the player's highest-frag headband.
    if (p.frags > g.bestFrags) { g.bestFrags = p.frags; g.primaryHeadband = p.headband; g.team = p.team; }
  }

  // --- 2. Rounds (marshal-entered) -> wins per team + match winner ---------
  const roundsWonByTeam: Record<string, number> = {};
  for (const r of roundResults) if (r.winnerColour) roundsWonByTeam[r.winnerColour] = (roundsWonByTeam[r.winnerColour] ?? 0) + 1;
  const roundCount = roundResults.length;
  let winner: string | null = null; let topWins = 0; let tied = false;
  for (const [team, wins] of Object.entries(roundsWonByTeam)) {
    if (wins > topWins) { winner = team; topWins = wins; tied = false; }
    else if (wins === topWins) tied = true;
  }
  if (tied) winner = null; // an even split leaves no match winner

  // --- 3. Per-player scoring ----------------------------------------------
  type Scored = Group & { accuracy: number; kd: number; score: number };
  const scored: Scored[] = [...groups.values()].map((g) => {
    const accuracy = g.shots > 0 ? g.hits / g.shots : 0;
    const kd = g.deaths > 0 ? g.frags / g.deaths : g.frags;
    const score = killScoreOf(g.frags, g.damage, accuracy, kd, formula);
    return { ...g, accuracy, kd, score };
  });

  const teamScore: Record<string, number> = {};
  for (const s of scored) teamScore[s.team] = (teamScore[s.team] ?? 0) + s.score;
  const scores = scored.map((s) => s.score);
  const kills = scored.map((s) => s.frags);
  const deathsArr = scored.map((s) => s.deaths);
  const kds = scored.map((s) => s.kd);
  const accs = scored.map((s) => s.accuracy);
  const dmgs = scored.map((s) => s.damage);
  const matchAvg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const rankOf = (vals: number[], v: number, higher = true) => 1 + vals.filter((x) => (higher ? x > v : x < v)).length;

  // --- Accolades: offline = stat-based only. CAP-Tain + Fortress need the
  // objective data the offline file doesn't carry, so they're skipped here;
  // Specialist is omitted to match the online path (needs per-round gun). ---
  const normKey = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
  const OFFLINE_EXCLUDE = new Set(["CAP-Tain", "Fortress"]);
  const accoladeStats: AccoladeStat[] = scored.map((s, i) => ({
    id: i,
    name: identity(s.primaryHeadband).nickname || s.primaryHeadband,
    team: s.team,
    score: s.score, frags: s.frags, deaths: s.deaths, kd: s.kd, shots: s.shots, hits: s.hits,
    accuracy: s.accuracy, wounds: s.wounds, damage: Math.round(s.damage), captures: 0, holdSeconds: 0,
  }));
  const accoladeXpByIndex = new Map<number, number>();
  const awards: CommitAward[] = [];
  if (accoladeByKey) {
    for (const w of computeAccolades(accoladeStats)) {
      if (OFFLINE_EXCLUDE.has(w.name)) continue;
      const def = accoladeByKey.get(normKey(w.name));
      if (!def) continue;
      const g = scored[w.winnerId];
      const idn = identity(g.primaryHeadband);
      awards.push({ account_id: idn.accountId, headset_label: g.primaryHeadband, nickname: idn.nickname, accolade_definition_id: def.id, xp_granted: def.xp });
      accoladeXpByIndex.set(w.winnerId, (accoladeXpByIndex.get(w.winnerId) ?? 0) + def.xp);
    }
    const specDef = accoladeByKey.get(normKey("Specialist"));
    if (specDef) {
      for (const wi of specialistWinners(scored.map((s, i) => ({ id: i, gun: identity(s.primaryHeadband).gun ?? null, score: s.score, frags: s.frags, name: identity(s.primaryHeadband).nickname || s.primaryHeadband })))) {
        const g = scored[wi];
        const idn = identity(g.primaryHeadband);
        awards.push({ account_id: idn.accountId, headset_label: g.primaryHeadband, nickname: idn.nickname, accolade_definition_id: specDef.id, xp_granted: specDef.xp });
        accoladeXpByIndex.set(wi, (accoladeXpByIndex.get(wi) ?? 0) + specDef.xp);
      }
    }
  }

  const aggregates: CommitAggregate[] = scored.map((s, i) => {
    const idn = identity(s.primaryHeadband);
    const isWinner = winner != null && s.team === winner;
    const oppTeam = Object.keys(teamScore).find((t) => t !== s.team);
    const mult = Math.max(idn.xpMultiplier ?? 1, isDoubleXp ? 2 : 1);
    const rating = matchAvg > 0 ? s.score / matchAvg : 0;
    const xpb = computeMatchXp({ rating, roundsWon: roundsWonByTeam[s.team] ?? 0, isWinner, accoladeXp: accoladeXpByIndex.get(i) ?? 0, multiplier: mult }, cfg);
    return {
      account_id: idn.accountId, nickname: idn.nickname, headset_label: s.primaryHeadband, team_colour: s.team,
      profile_pic_url: idn.profilePicUrl ?? null, gun_used: idn.gun ?? null,
      frags: s.frags, deaths: s.deaths, hits: s.hits, shots: s.shots, wounds: s.wounds, spawn_kills: 0, spawn_damage: 0, captures: 0, hold_seconds: 0,
      accuracy: Math.round(s.accuracy * 10000) / 10000, kd: Math.round(s.kd * 100) / 100, damage: Math.round(s.damage), score: s.score,
      match_rating: matchAvg > 0 ? Math.round(rating * 100) / 100 : 0, match_average_score: Math.round(matchAvg),
      score_performance_delta: Math.round(s.score - matchAvg), xp_multiplier: mult,
      score_rank: rankOf(scores, s.score), kills_rank: rankOf(kills, s.frags), deaths_rank: rankOf(deathsArr, s.deaths, false),
      kd_rank: rankOf(kds, s.kd), accuracy_rank: rankOf(accs, s.accuracy), damage_rank: rankOf(dmgs, s.damage),
      was_winner: isWinner, rounds_won: roundsWonByTeam[s.team] ?? 0, rounds_lost: roundCount - (roundsWonByTeam[s.team] ?? 0), rounds_played: roundCount, rounds_won_present: roundsWonByTeam[s.team] ?? 0, online_rounds_played: 0,
      team_score: teamScore[s.team] ?? 0, opponent_team_score: oppTeam ? teamScore[oppTeam] ?? 0 : 0,
      xp_from_points: xpb.xpFromPoints, xp_from_wins: xpb.xpFromWins, xp_from_accolades: xpb.xpFromAccolades, xp_total: xpb.xpTotal,
      // Offline: no event timeline -> no streaks, nemesis, kill lists.
      streaks: [], nemesis: null, killed: [], killed_by: [],
    };
  });

  const loser = winner ? Object.keys(teamScore).find((t) => t !== winner) ?? null : null;
  const netResultSummary: NetResultSummary = {
    round_wins: { ...roundsWonByTeam },
    team_ratings: { ...teamScore },
    winning_team: winner,
    losing_team: loser,
    winning_rounds: winner ? roundsWonByTeam[winner] ?? 0 : 0,
    losing_rounds: loser ? roundsWonByTeam[loser] ?? 0 : 0,
  };

  return { aggregates, awards, winnerColour: winner, losingColour: loser, roundsWonByTeam, roundCount, netResultSummary };
}
