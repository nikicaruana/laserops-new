/* eslint-disable */
/**
 * scripts/build-scenario-lab.ts  (localhost experiment — dev only, do NOT ship)
 * --------------------------------------------------------------------
 * Bakes app/scoring-lab/aggregates.json with MULTIPLE games so the lab can switch
 * between them and score each across the scenarios. For each game we run the REAL
 * engine (buildMatchReportV2) so Scenario 1 reproduces its published report; the
 * scenarios then only re-weight the objective (caps/recaps/hold). Kill/streak
 * scores + caps/recaps/hold facts are computed once at the standard exploit rules
 * (min-hold 3s, recap window 20s); each game keeps its own spawn window.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { buildMatchReportV2, V2_SCORING } from "../lib/match-report-v2/build";

const TMP = "C:/Users/nikic/AppData/Local/Temp";
const LAB30 = `${TMP}/claude/C--Users-nikic-Documents-Laseropsmalta-com-laserops-new--claude-worktrees-beautiful-bouman-66c3b3/f0f41fbf-4edc-4679-b4aa-7e0e88372652/scratchpad/LO-2026-30/rounds`;

type Game = {
  matchId: string; label: string; files: string[];
  ops: Record<number, string>; spawnWindowSeconds?: number;
};

const GAMES: Game[] = [
  {
    matchId: "LO-2026-30", label: "LO-2026-30 · Online Domination",
    files: [1, 2, 3, 4, 5].map((n) => `${LAB30}/r${n}.json`),
    // Head 06 + 39 both = Kyle (merged by the remap).
    ops: { 1: "Uros", 4: "Agius89", 5: "Kuba", 6: "Kyle", 7: "Buwdha", 9: "OrteGaTD", 21: "Hasapardi", 23: "Jens",
      26: "Sina", 27: "Glenn", 32: "ChrisKyle", 37: "_Stivala_", 39: "Kyle", 40: "Tompa", 41: "POL",
      42: "Maltese Predator", 43: "Waldemar", 44: "M1hoTD", 53: "Migz", 58: "TheHolySpirit" },
    spawnWindowSeconds: 4,
  },
  {
    matchId: "LO-2026-29", label: "LO-2026-29 · 5v5 Online Domination",
    files: ["150411", "153101", "155756", "161718", "164759"].map((s) => `${TMP}/RealtimeStatistics_20260912_${s}.json`),
    // HB45 -> 40 (aximus/... ) merge: 45 shares 40's ops tag; 45 is the empty half.
    ops: { 39: "ChrisKyle", 41: "Snaaaaaaake", 1: "Sina", 9: "Hasapardi", 26: "Wugy", 40: "Jens", 45: "Jens",
      53: "PourHoneyOnMyBun", 2: "Mustafa", 6: "Maltese Predator", 47: "BlueJay" },
  },
  {
    matchId: "LO-2026-27", label: "LO-2026-27 · 5v5 Online Domination",
    files: [1, 2, 3, 4, 5].map((n) => `sample-game-data/r${n}.json`),
    ops: { 1: "Snaaaaaaake", 6: "Jens", 40: "TheHolySpirit", 42: "Tompa", 45: "aximus",
      2: "Buwdha", 4: "Sina", 37: "BSoD", 39: "Jinnies", 41: "Glenn" },
  },
];

const games = GAMES.map((g) => {
  const rawRounds = g.files.map((f) => ({ raw: readFileSync(f, "utf8") }));
  const rep = buildMatchReportV2(rawRounds, { matchId: g.matchId, label: g.label },
    { opsTagByHeadband: g.ops, scoring: g.spawnWindowSeconds ? { spawnWindowSeconds: g.spawnWindowSeconds } : {} });
  const players = rep.players
    .filter((p) => p.frags + p.deaths + p.captures + p.holdSeconds > 0)
    .map((p) => ({
      name: p.name, team: p.team, kills: p.frags, deaths: p.deaths, damage: Math.round(p.damage),
      caps: p.captures, recaps: p.recaptures, hold: Math.round(p.holdSeconds),
      killScore: p.killScore, streakScore: p.streakScore,
    }))
    .sort((a, b) => (b.killScore + b.streakScore) - (a.killScore + a.streakScore));
  console.log(`${g.matchId}: ${players.length} players, winner ${rep.matchWinner}, spawn ${g.spawnWindowSeconds ?? V2_SCORING.spawnWindowSeconds}s`);
  return {
    matchId: g.matchId, matchLabel: g.label, matchDate: (rep.date ?? "").split(" ")[0],
    minHold: V2_SCORING.minHoldSeconds, recapWindow: V2_SCORING.recaptureWindowSeconds,
    spawnWindow: g.spawnWindowSeconds ?? V2_SCORING.spawnWindowSeconds, players,
  };
});

writeFileSync("app/scoring-lab/aggregates.json", JSON.stringify({ games }, null, 2));
console.log(`\nWrote ${games.length} games to app/scoring-lab/aggregates.json`);
