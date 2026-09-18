/**
 * lib/match-report/preview-data.ts
 * --------------------------------------------------------------------
 * Dummy MatchReport for the admin design preview, fed the REAL report
 * components. Real badge/image/accolade/rank assets are passed in from the
 * preview page (fetched from config tables) so it looks like a live report.
 * Stats are fabricated but leadership is spread across players, and accolades
 * are assigned to the actual stat leaders (e.g. Eagle Eye -> top accuracy).
 * objCaps = number of captures; capTime = seconds holding bases; the SCORE from
 * those is already folded into `score` (like kills). This is the ingestion spec.
 */
import type { GameInfo } from "@/lib/cms/game-id-map";
import type { GameDataRow } from "@/lib/game-data/lookup";
import type { MatchPlayer, MatchReport, MatchStreak, KillTally } from "@/lib/match-report/engine";
import type { RankLevel } from "@/lib/cms/ranking-system";
import type { Accolade } from "@/lib/cms/accolades";
import { DEFAULT_AVATAR_URL } from "@/lib/avatar";

const sb = (key: string) => `https://res.cloudinary.com/dqud5b7pa/image/upload/laseropsmalta.com/streak-badges/${key}.png`;
const streak = (key: string, name: string, description: string, points: number, count: number): MatchStreak => ({ key, name, description, badgeUrl: sb(key), points, count });

type Base = {
  nickname: string;
  team: "Red" | "Blue";
  level: number;
  score: number;
  kills: number;
  deaths: number;
  accuracy: number; // 0..1
  damage: number;
  totalXp: number;
  objCaps: number; // number of captures
  capTime: number; // seconds holding bases
  streaks: MatchStreak[];
};

// Leadership is deliberately spread: score=Kini, kills+accuracy=Ghost,
// fewest-deaths=Blaze, damage=Viper, captures+hold=Rook.
const BASE: Base[] = [
  { nickname: "Kini", team: "Red", level: 12, score: 5010, kills: 20, deaths: 14, accuracy: 0.40, damage: 11000, totalXp: 1450, objCaps: 6, capTime: 420, streaks: [streak("kill_streak_3", "3-Streak", "3 kills in a row without dying.", 25, 2), streak("bully", "Bully", "Killing the same player 10 times in one round.", 100, 1), streak("revenge", "Revenge", "Kill the person who killed you last.", 25, 3)] },
  { nickname: "Ghost", team: "Blue", level: 23, score: 4820, kills: 25, deaths: 12, accuracy: 0.46, damage: 10800, totalXp: 1380, objCaps: 4, capTime: 260, streaks: [streak("kill_streak_5", "5-Streak", "5 kills in a row without dying.", 50, 1), streak("first_blood", "First Blood", "First kill of a round.", 25, 1)] },
  { nickname: "Viper", team: "Red", level: 18, score: 4110, kills: 18, deaths: 16, accuracy: 0.38, damage: 12800, totalXp: 1180, objCaps: 3, capTime: 300, streaks: [streak("revenge", "Revenge", "Kill the person who killed you last.", 25, 1)] },
  { nickname: "Blaze", team: "Blue", level: 15, score: 3890, kills: 17, deaths: 11, accuracy: 0.36, damage: 9800, totalXp: 1090, objCaps: 4, capTime: 380, streaks: [streak("shadow", "Shadow", "A full round without dying (5+ kills to qualify).", 100, 1)] },
  { nickname: "Nova", team: "Red", level: 20, score: 3560, kills: 15, deaths: 18, accuracy: 0.33, damage: 8600, totalXp: 980, objCaps: 5, capTime: 510, streaks: [streak("captures_3", "3x Cap", "3 base captures in one round.", 25, 1)] },
  { nickname: "Rook", team: "Blue", level: 9, score: 3320, kills: 14, deaths: 19, accuracy: 0.31, damage: 7900, totalXp: 910, objCaps: 9, capTime: 640, streaks: [streak("captures_3", "3x Cap", "3 base captures in one round.", 25, 2), streak("immortal", "Immortal", "More than 1 kill while on 10 health or less.", 50, 1)] },
  { nickname: "Echo", team: "Red", level: 14, score: 2980, kills: 12, deaths: 17, accuracy: 0.29, damage: 6700, totalXp: 820, objCaps: 2, capTime: 120, streaks: [] },
  { nickname: "Frost", team: "Blue", level: 7, score: 2740, kills: 11, deaths: 20, accuracy: 0.27, damage: 6100, totalXp: 760, objCaps: 1, capTime: 90, streaks: [] },
];

// Fabricated kill matrix: KILLS[attacker][victim] = count (cross-team).
const KILLS: Record<string, Record<string, number>> = {
  Kini: { Ghost: 6, Blaze: 4, Rook: 5, Frost: 7 },
  Viper: { Ghost: 3, Blaze: 5, Rook: 4, Frost: 7 },
  Nova: { Ghost: 2, Blaze: 4, Rook: 6, Frost: 3 },
  Echo: { Ghost: 1, Blaze: 3, Rook: 5, Frost: 3 },
  Ghost: { Kini: 8, Viper: 5, Nova: 6, Echo: 6 },
  Blaze: { Kini: 4, Viper: 6, Nova: 4, Echo: 4 },
  Rook: { Kini: 3, Viper: 5, Nova: 5, Echo: 1 },
  Frost: { Kini: 2, Viper: 4, Nova: 3, Echo: 2 },
};

const levelOf = new Map(BASE.map((b) => [b.nickname, b.level]));

const killedList = (nick: string): KillTally[] =>
  Object.entries(KILLS[nick] ?? {}).map(([n, c]) => ({ nickname: n, count: c })).sort((a, b) => b.count - a.count);
const killedByList = (nick: string): KillTally[] =>
  Object.keys(KILLS).map((a) => ({ nickname: a, count: KILLS[a]?.[nick] ?? 0 })).filter((x) => x.count > 0).sort((a, b) => b.count - a.count);

function ranker<K extends keyof Base>(key: K, higherBetter = true) {
  const vals = BASE.map((b) => Number(b[key]));
  return (v: number) => 1 + vals.filter((x) => (higherBetter ? x > v : x < v)).length;
}

/** Leader (nickname) for each stat category. */
function statLeaders() {
  const maxBy = <K extends keyof Base>(k: K) => BASE.reduce((a, b) => (Number(b[k]) > Number(a[k]) ? b : a)).nickname;
  const minBy = <K extends keyof Base>(k: K) => BASE.reduce((a, b) => (Number(b[k]) < Number(a[k]) ? b : a)).nickname;
  return {
    accuracy: maxBy("accuracy"),
    kills: maxBy("kills"),
    score: maxBy("score"),
    damage: maxBy("damage"),
    caps: maxBy("objCaps"),
    hold: maxBy("capTime"),
    deaths: minBy("deaths"),
  };
}

/** Assign each accolade to the leader of the stat its name implies (one per
 *  category), so awards land on the right player and spread out. */
function assignAccolades(accolades: Accolade[]): Map<string, Accolade[]> {
  const L = statLeaders();
  const categories: { leader: string; test: RegExp }[] = [
    { leader: L.accuracy, test: /eagle|accura|sharp|marksman|aim|eye|dead.?eye/i },
    { leader: L.kills, test: /kill|slay|frag|spree|reaper|assassin|hunter|terminat/i },
    { leader: L.score, test: /mvp|score|dominat|\btop\b|champion|legend|carry/i },
    { leader: L.damage, test: /damage|heavy|destroy|demolit|brute|wreck/i },
    { leader: L.caps, test: /captur|objective|\bcap\b|control|conquer|flag/i },
    { leader: L.hold, test: /hold|defen|guard|anchor|fortress|sentinel|keeper/i },
    { leader: L.deaths, test: /surviv|immortal|untouch|\btank\b|iron|unbreak|juggernaut/i },
  ];
  const map = new Map<string, Accolade[]>();
  const used = new Set<string>();
  for (const cat of categories) {
    const a = accolades.find((x) => !used.has(x.key) && cat.test.test(x.name));
    if (!a) continue;
    used.add(a.key);
    const arr = map.get(cat.leader) ?? [];
    arr.push(a);
    map.set(cat.leader, arr);
  }
  return map;
}

type Opts = {
  guns: { name: string; image: string }[];
  teamBadges: { Red?: string; Blue?: string };
  ranks: RankLevel[];
  rankBadgeByLevel: (level: number) => string;
  accolades: Accolade[];
};

function mkPlayer(b: Base, idx: number, opts: Opts, accs: Accolade[]): MatchPlayer {
  const kd = b.kills / Math.max(1, b.deaths);
  const kds = BASE.map((x) => x.kills / Math.max(1, x.deaths));
  const kdRank = 1 + kds.filter((x) => x > kd).length;

  const killed = killedList(b.nickname);
  const killedBy = killedByList(b.nickname);
  const oppNames = new Set([...killed, ...killedBy].map((k) => k.nickname));
  let nemesis: MatchPlayer["nemesis"] = null;
  let bestTotal = -1;
  for (const opp of oppNames) {
    const forC = KILLS[b.nickname]?.[opp] ?? 0;
    const againstC = KILLS[opp]?.[b.nickname] ?? 0;
    if (forC + againstC > bestTotal) {
      bestTotal = forC + againstC;
      // Head-to-head damage (dummy): derived from the kills between them so the
      // preview looks plausible. Real ingestion computes per-opponent damage.
      nemesis = { nickname: opp, profilePicUrl: DEFAULT_AVATAR_URL, level: levelOf.get(opp) ?? 1, killsFor: forC, killsAgainst: againstC, damageFor: forC * 900 + 300, damageAgainst: againstC * 900 + 300 };
    }
  }

  const gun = opts.guns.length ? opts.guns[idx % opts.guns.length] : { name: "Standard", image: "" };

  return {
    row: {} as GameDataRow,
    nickname: b.nickname,
    profilePicUrl: DEFAULT_AVATAR_URL,
    teamColor: b.team,
    teamColorLower: b.team.toLowerCase(),
    level: b.level,
    rankBadgeUrl: opts.rankBadgeByLevel(b.level),
    score: b.score,
    kills: b.kills,
    spawnKills: Math.round(b.kills * 0.12),
    spawnDamage: Math.round(b.damage * 0.06),
    deaths: b.deaths,
    kd,
    accuracy: b.accuracy,
    damage: b.damage,
    totalXp: b.totalXp,
    gunUsed: gun.name,
    gunUsedImage: gun.image,
    scoreRank: ranker("score")(b.score),
    killsRank: ranker("kills")(b.kills),
    deathsRank: ranker("deaths", false)(b.deaths),
    kdRank,
    accuracyRank: ranker("accuracy")(b.accuracy),
    damageRank: ranker("damage")(b.damage),
    matchRating: 0,
    averageMatchScore: 0,
    scorePerformanceDelta: 0,
    teamRoundsWon: b.team === "Red" ? 3 : 2,
    teamRoundsLost: b.team === "Red" ? 2 : 3,
    isWinner: b.team === "Red",
    teamBadgeImage: "",
    xpFromPoints: Math.round(b.totalXp * 0.6),
    xpFromWins: Math.round(b.totalXp * 0.25),
    xpFromAccolades: Math.round(b.totalXp * 0.15),
    xpEarnedThisMatch: b.totalXp,
    xpTotalBeforeMatch: 10000,
    xpTotalAfterMatch: 10000 + b.totalXp,
    xpCurrentLevelBeforeMatch: b.level,
    xpCurrentLevelAfterMatch: b.level,
    xpCurrentLevelMinBeforeMatch: 0,
    xpNextLevelMinBeforeMatch: 2000,
    xpLevelProgressStart: 0.3,
    xpLevelProgressEnd: 0.6,
    xpLevelUpInMatch: false,
    xpLevelBadgeImage: opts.rankBadgeByLevel(b.level),
    earnedAccolades: accs.map((accolade) => ({ accolade })),
    objCaps: b.objCaps,
    objCapsRank: ranker("objCaps")(b.objCaps),
    capTime: b.capTime,
    capTimeRank: ranker("capTime")(b.capTime),
    matchStreaks: b.streaks,
    nemesis,
    killed,
    killedBy,
  };
}

export function buildPreviewReport(opts: Opts): MatchReport {
  const accByPlayer = assignAccolades(opts.accolades);
  const players = BASE.map((b, i) => mkPlayer(b, i, opts, accByPlayer.get(b.nickname) ?? [])).sort((a, b) => a.scoreRank - b.scoreRank);
  const game: GameInfo = {
    matchId: "LO-2026-PREVIEW",
    rawGameId: "",
    gameStartTimeYear: "2026",
    gameNo: "1",
    isPrivate: false,
    isDoubleXp: false,
    teams: { red: { roundWins: 3, rating: 5010 }, blue: { roundWins: 2, rating: 4820 }, yellow: { roundWins: 0, rating: 0 } },
    winningTeam: "Red",
    losingTeam: "Blue",
    winningTeamRounds: 3,
    losingTeamRounds: 2,
    winningTeamRating: 5010,
    losingTeamRating: 4820,
    winningTeamBadge: opts.teamBadges.Red ?? "",
    losingTeamBadge: opts.teamBadges.Blue ?? "",
  };
  return { game, players, ranks: opts.ranks, matchDate: "Sat, 13 Sep 2026" };
}
