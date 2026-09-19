/**
 * lib/match-report-v2/report-types.ts
 * --------------------------------------------------------------------
 * Self-contained data-shape types for the LIVE-site Match Report v2 (Beta).
 * No runtime imports — the beta renders a precomputed MatchReport JSON, so it
 * carries results only (no parser/ingestion). Mirrors lib/match-report/engine.ts.
 */

export type RankLevel = { level: number; rankName: string; scoreThreshold: number; estGames: number; badgeUrl: string };
export type Accolade = { name: string; key: string; description: string; badgeUrl: string; xp: number };
export type EarnedAccolade = { accolade: Accolade };

export type GameInfo = {
  matchId: string;
  rawGameId: string;
  gameStartTimeYear: string;
  gameNo: string;
  isPrivate: boolean;
  isDoubleXp: boolean;
  teams: {
    red: { roundWins: number; rating: number };
    blue: { roundWins: number; rating: number };
    yellow: { roundWins: number; rating: number };
  };
  winningTeam: string;
  losingTeam: string;
  winningTeamRounds: number;
  losingTeamRounds: number;
  winningTeamRating: number;
  losingTeamRating: number;
  winningTeamBadge: string;
  losingTeamBadge: string;
  matchKind?: "ladder" | "squad" | null;
  ladderName?: string | null;
  winningTeamName?: string | null;
  losingTeamName?: string | null;
};

export type MatchStreak = { key: string; name: string; description: string; badgeUrl: string; points: number; count: number };
export type KillTally = { nickname: string; count: number };
export type Nemesis = {
  nickname: string;
  profilePicUrl: string;
  level: number;
  killsFor: number;
  killsAgainst: number;
  damageFor: number;
  damageAgainst: number;
};

export type MatchPlayer = {
  row: unknown;
  nickname: string;
  profilePicUrl: string;
  teamColor: string;
  teamColorLower: string;
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
  scoreRank: number;
  killsRank: number;
  deathsRank: number;
  kdRank: number;
  accuracyRank: number;
  damageRank: number;
  matchRating: number;
  averageMatchScore: number;
  scorePerformanceDelta: number;
  teamRoundsWon: number;
  teamRoundsLost: number;
  isWinner: boolean;
  teamBadgeImage: string;
  xpFromPoints: number;
  xpFromWins: number;
  xpFromAccolades: number;
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
  earnedAccolades: EarnedAccolade[];
  objCaps?: number;
  objCapsRank?: number;
  capTime?: number;
  capTimeRank?: number;
  matchStreaks?: MatchStreak[];
  nemesis?: Nemesis | null;
  killed?: KillTally[];
  killedBy?: KillTally[];
};

export type MatchReport = {
  game: GameInfo;
  players: MatchPlayer[];
  ranks: RankLevel[];
  matchDate: string;
  label?: string;
  generatedAt?: string;
  /** Per-report scoring config (drives the notes box). Absent on older reports. */
  scoring?: {
    capturePoints: number;
    recapturePoints: number;
    recaptureWindowSeconds: number;
    minHoldSeconds: number;
    holdPerSecond: number;
    spawnWindowSeconds: number;
  };
};
