/**
 * lib/match-report-v2/types.ts
 * --------------------------------------------------------------------
 * Pure data-shape types for a Match Report v2 (Beta). NO runtime/processing
 * imports — safe to ship to the live V1 site alongside a precomputed report
 * JSON, so the display page carries results only (no parser/ingestion).
 */

export type PairTally = { name: string; count: number };
export type Nemesis = { name: string; killsAgainst: number; killsFor: number } | null;

export type KillMatrix = {
  names: string[];
  rows: Record<string, Record<string, number>>;
  perPlayer: Record<string, { killed: PairTally[]; killedBy: PairTally[]; nemesis: Nemesis }>;
};

export type PlayerStreak = { key: string; name: string; count: number; points: number };

export type AccoladeWin = {
  key: string;
  name: string;
  winnerId: number;
  winnerName: string;
  stat: string;
  value: number;
};

export type PlayerReport = {
  id: number;
  name: string;
  team: string;
  frags: number;
  deaths: number;
  kd: number;
  accuracy: number;
  shots: number;
  hits: number;
  wounds: number;
  damage: number;
  spawnKills: number;
  spawnDamage: number;
  captures: number;
  recaptures: number;
  excludedCaptures: number;
  roundsPlayed: number;
  roundsWonPresent: number;
  holdSeconds: number;
  killScore: number;
  objectiveScore: number;
  streakScore: number;
  totalScore: number;
  streaks: PlayerStreak[];
  accolades: string[];
  killed: PairTally[];
  killedBy: PairTally[];
  nemesis: Nemesis;
};

export type MatchReportV2 = {
  matchId: string;
  label: string;
  date: string | null;
  roundCount: number;
  rounds: { index: number; winnerTeam: string | null; allBasesBurned: boolean; durationSeconds: number | null }[];
  teams: { colour: string; name: string; roundsWon: number; playerNames: string[] }[];
  matchWinner: string | null;
  roundsWonByTeam: Record<string, number>;
  players: PlayerReport[];
  accolades: AccoladeWin[];
  killMatrix: KillMatrix;
  generatedAt: string;
};
