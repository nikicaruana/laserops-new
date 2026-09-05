/**
 * lib/narrative/input.ts
 * --------------------------------------------------------------------
 * Assembles the structured facts about a player's match that the AI turns into
 * a short write-up. Only real numbers go in - the model narrates them, it never
 * invents stats. Fields that need data we don't have yet (lifetime history,
 * weapon-wide averages, last-match comparison) are optional and simply omitted
 * until ingestion + aggregates provide them.
 */
import type { MatchPlayer, MatchReport } from "@/lib/match-report/engine";

export type Rival = { nickname: string; count: number };

/** One base capture within a round. */
export type Capture = {
  base: string;
  holdSeconds: number; // how long they held it this round
  burned: boolean; // pushed this base to its 10-minute (600s) total cap
  roundWinning: boolean; // this capture won the round
};

export type RoundStory = {
  roundNo: number;
  won: boolean;
  score: number;
  kills: number;
  deaths: number;
  captures: Capture[];
};

export type NarrativeInput = {
  nickname: string;
  level: number;
  match: {
    score: number;
    scoreRank: number;
    playersInMatch: number;
    kills: number;
    deaths: number;
    kd: number;
    accuracyPct: number;
    damage: number;
    objCaps: number;
    capTimeSeconds: number;
    isWinner: boolean;
    teamRoundsWon: number;
    teamRoundsLost: number;
    gun: string;
  };
  streaks: { name: string; count: number }[];
  /** Per-round breakdown - the heart of the write-up. Empty until ingestion
   *  provides round data (the preview supplies representative sample rounds). */
  rounds: RoundStory[];
  /** Head-to-head battles: who this player got the better of, and who troubled them. */
  rivalries: {
    dominated: Rival[]; // players they killed the most
    troubledBy: Rival[]; // players who killed them the most
    nemesis: { nickname: string; youKilled: number; killedYou: number } | null;
  };
  /** Optional - filled in once the data exists. */
  history?: {
    gamesPlayedBefore?: number;
    firstTimeWithGun?: boolean;
    gunAvgScoreAllPlayers?: number; // how people generally do with this gun
    previousMatchScore?: number; // for improvement
  };
};

export function buildNarrativeInput(report: MatchReport, p: MatchPlayer, rounds: RoundStory[] = []): NarrativeInput {
  const killed = [...(p.killed ?? [])].sort((a, b) => b.count - a.count).slice(0, 3);
  const killedBy = [...(p.killedBy ?? [])].sort((a, b) => b.count - a.count).slice(0, 3);
  return {
    nickname: p.nickname,
    level: p.level,
    rounds,
    match: {
      score: p.score,
      scoreRank: p.scoreRank,
      playersInMatch: report.players.length,
      kills: p.kills,
      deaths: p.deaths,
      kd: Number(p.kd.toFixed(2)),
      accuracyPct: Math.round(p.accuracy * 100),
      damage: p.damage,
      objCaps: p.objCaps ?? 0,
      capTimeSeconds: p.capTime ?? 0,
      isWinner: p.isWinner,
      teamRoundsWon: p.teamRoundsWon,
      teamRoundsLost: p.teamRoundsLost,
      gun: p.gunUsed,
    },
    streaks: (p.matchStreaks ?? []).map((s) => ({ name: s.name, count: s.count })),
    rivalries: {
      dominated: killed.map((k) => ({ nickname: k.nickname, count: k.count })),
      troubledBy: killedBy.map((k) => ({ nickname: k.nickname, count: k.count })),
      nemesis: p.nemesis ? { nickname: p.nemesis.nickname, youKilled: p.nemesis.killsFor, killedYou: p.nemesis.killsAgainst } : null,
    },
  };
}

/**
 * Representative per-round data for the PREVIEW (no real round data exists yet).
 * Deterministic from the player's totals, and deliberately seeds a burned base
 * and a round-winning capture for high-objective players so the write-up can
 * demonstrate those beats. Real ingestion replaces this with actual rounds.
 */
export function previewRounds(p: MatchPlayer): RoundStory[] {
  const totalRounds = Math.max(1, p.teamRoundsWon + p.teamRoundsLost);
  const bases = ["Alpha", "Bravo", "Charlie"];
  const totalCaps = p.objCaps ?? 0;
  const totalHold = p.capTime ?? 0;
  const perCapHold = totalCaps > 0 ? Math.round(totalHold / totalCaps) : 0;
  const remainder = totalCaps % totalRounds;
  const perRound = Math.floor(totalCaps / totalRounds);

  // Spread wins across the round set; pick the last win for the round-winner beat.
  const wonSet = new Set<number>();
  for (let i = 0; i < p.teamRoundsWon; i++) wonSet.add(1 + Math.floor((i * totalRounds) / Math.max(1, p.teamRoundsWon)));
  const lastWonRound = [...wonSet].sort((a, b) => b - a)[0] ?? -1;

  const rounds: RoundStory[] = [];
  const baseCumulative: Record<string, number> = {};
  let capIdx = 0;
  let longest = { r: -1, c: -1, hold: -1 };

  for (let r = 1; r <= totalRounds; r++) {
    const won = wonSet.has(r);
    const capsThisRound = perRound + (r <= remainder ? 1 : 0);
    const captures: Capture[] = [];
    for (let c = 0; c < capsThisRound; c++) {
      const base = bases[capIdx % bases.length];
      capIdx++;
      baseCumulative[base] = (baseCumulative[base] ?? 0) + perCapHold;
      if (perCapHold > longest.hold) longest = { r: rounds.length, c, hold: perCapHold };
      captures.push({ base, holdSeconds: perCapHold, burned: baseCumulative[base] >= 600, roundWinning: false });
    }
    if (won && r === lastWonRound && captures.length > 0) captures[captures.length - 1].roundWinning = true;
    rounds.push({
      roundNo: r,
      won,
      score: Math.round(p.score / totalRounds),
      kills: Math.round(p.kills / totalRounds),
      deaths: Math.round(p.deaths / totalRounds),
      captures,
    });
  }

  // Seed at least one burned base for objective-heavy players so the beat shows.
  if (totalHold >= 400 && longest.r >= 0 && !rounds.some((rd) => rd.captures.some((c) => c.burned))) {
    rounds[longest.r].captures[longest.c].burned = true;
  }
  return rounds;
}
