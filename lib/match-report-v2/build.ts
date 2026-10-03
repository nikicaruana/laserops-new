/**
 * lib/match-report-v2/build.ts
 * --------------------------------------------------------------------
 * Build a full Match Report v2 (Beta) from the raw round JSON of a match. The
 * report is derived ENTIRELY from JSON parsing: per-player stats, the v2 score
 * breakdown (kills + objective + streaks), match accolades (XP-only), the
 * who-killed-who matrix and nemesis. Pure – give it raw JSONL per round.
 *
 * Scoring is the locked v2 model (see [[match-scorecard-template]]):
 *   Kill  = round((frags×50 + dmg×0.2) × (1+acc×0.2) × (1+kd×0.12)), spawn voided
 *   Obj B = captures×75 + recaptures×50 + hold×2   (sub-5s captures excluded)
 *   Streaks add to score; accolades are XP-only (not in score).
 */
import { parseRound, type Round } from "../ingestion/round-parser";
import { effectiveWithResolutions, type RoundResolutions } from "../ingestion/resolutions";
import { detectStreaks, STREAK_NAMES, KILL_STREAK_KEYS, detectCrossRoundKillStreaks } from "../ingestion/streaks";
import { buildKillMatrix } from "../ingestion/kill-matrix";
import { computeAccolades } from "../ingestion/accolades";
import { computeGroupValue, type ScoreFormula } from "../scoring/formula";
import type { KillMatrix, PairTally, PlayerStreak, PlayerReport, MatchReportV2 } from "./types";

export type { KillMatrix, PairTally, PlayerStreak, PlayerReport, MatchReportV2 } from "./types";

export const V2_SCORING = {
  spawnWindowSeconds: 3,
  minHoldSeconds: 3,
  recaptureWindowSeconds: 20,
  capturePoints: 75,
  recapturePoints: 50,
  holdPerSecond: 2,
};

// Streak points (supabase/migrations/20260731350000_seed_streaks.sql).
export const STREAK_POINTS: Record<string, number> = {
  kill_streak_3: 25, kill_streak_5: 50, kill_streak_10: 100, kill_streak_20: 200,
  survivor: 50, first_blood: 25, last_blood: 25, clutch_move: 50, ptfo: 50, map_domination: 100,
  clean_sweep: 50, grim_reaper: 100, streak_ender: 50, hold_base_3min: 50, hold_base_5min: 100, hold_base_10min: 200,
  captures_3: 25, captures_5: 50, captures_10: 100, burner_1: 50, burner_2: 200, bully: 100, shadow: 100,
};

function ep(t: string): number { const m = t.match(/(\d+)\.(\d+)\.(\d+) (\d+):(\d+):(\d+)/); if (!m) return NaN; return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000; }

/** Death-anchored respawns: first HP==maxHp frame at/after each Deaths increment. */
function respawnsFromRaw(raw: string, maxHp: number): Record<number, number[]> {
  const evs: { pid: number; ep: number; hp?: number; deaths?: number }[] = [];
  for (const line of raw.split(/\r?\n/)) { const l = line.trim(); if (!l) continue; let o: any; try { o = JSON.parse(l); } catch { continue; } if (o.ItemType !== "PlayerEvent") continue; const it = o.Item || {}; evs.push({ pid: it.PlayerId, ep: ep(o.EventTime), hp: it.HP, deaths: it.Deaths }); }
  const byP: Record<number, typeof evs> = {}; for (const e of evs) (byP[e.pid] ??= []).push(e);
  const respawns: Record<number, number[]> = {};
  for (const pid of Object.keys(byP).map(Number)) {
    const arr = byP[pid].sort((a, b) => a.ep - b.ep); let prevDeaths = 0, awaiting = false; const list: number[] = [];
    for (const e of arr) { if (e.deaths != null && e.deaths > prevDeaths) { awaiting = true; prevDeaths = e.deaths; } if (awaiting && e.hp === maxHp) { list.push(e.ep); awaiting = false; } }
    respawns[pid] = list;
  }
  return respawns;
}

type Acc = {
  id: number; name: string; team: string;
  frags: number; deaths: number; hits: number; shots: number; wounds: number; damage: number;
  spawnKills: number; spawnDamage: number;
  captures: number; recaptures: number; excluded: number; hold: number;
  streakPoints: number; streaks: Record<string, number>;
  roundsPlayed: Set<number>; roundsWon: Set<number>; onlineRoundsPlayed: Set<number>;
};

export function buildMatchReportV2(
  rawRounds: { raw: string; resolutions?: RoundResolutions; winnerOverride?: string | null; countsAsRound?: boolean }[],
  meta: { matchId: string; label: string; date?: string | null },
  opts?: {
    scoring?: Partial<typeof V2_SCORING>;
    /** Admin per-mode score formula; when set, kill + objective come from it. */
    formula?: ScoreFormula;
    opsTagByHeadband?: Record<number, string>;
    /** Resolve a headband number to its canonical player name (ops tag).
     *  Merges headband switches at aggregation so per-round AND cross-round
     *  streaks stitch across a switch. Empty result = keep the raw name. */
    identityByHeadband?: (headbandNo: number) => string;
    /** DB streak definitions (streak_key -> name + points). When given it is
     *  authoritative for streak names AND points; the hardcoded maps are only a
     *  fallback for keys it doesn't cover. */
    streakConfig?: Record<string, { name: string; points: number }>;
    offline?: {
      statsByHeadband: Record<number, { frags: number; deaths: number; hits: number; shots: number; damage: number; wounds?: number; team: string }>;
      roundWinners: (string | null)[];
    };
    /** Headbands to drop before aggregation (e.g. a no-show/offline headband in an
     *  online match) - excluded from stats AND the match average. */
    excludeHeadbands?: number[];
  },
): MatchReportV2 {
  const { spawnWindowSeconds, minHoldSeconds, recaptureWindowSeconds, capturePoints, recapturePoints, holdPerSecond } = { ...V2_SCORING, ...(opts?.scoring ?? {}) };
  const formula = opts?.formula;
  // Streak names + points: DB (streakConfig) is authoritative when supplied,
  // else the built-in maps. Used for both scoring and the report display.
  const streakPointsOf = (key: string) => opts?.streakConfig?.[key]?.points ?? STREAK_POINTS[key] ?? 0;
  const streakNameOf = (key: string) => opts?.streakConfig?.[key]?.name ?? STREAK_NAMES[key] ?? key;
  const parsed: Round[] = rawRounds.map((r) => parseRound(r.raw, { spawnWindowSeconds }));
  if (opts?.excludeHeadbands?.length) {
    const ex = new Set(opts.excludeHeadbands);
    for (const r of parsed) r.players = r.players.filter((p) => p.headband_no == null || !ex.has(p.headband_no));
  }
  // Optional headband -> display-name remap, applied to the parsed roster BEFORE
  // aggregation — so it also MERGES multiple headbands worn by one person (e.g.
  // Head 06 + Head 39 both -> "Kyle") into one player everywhere downstream.
  if (opts?.opsTagByHeadband) {
    const m = opts.opsTagByHeadband;
    for (const r of parsed) for (const p of r.players) { if (p.headband_no != null && m[p.headband_no]) p.name = m[p.headband_no]; }
  }

  // Resolve each headband to its canonical identity (ops tag) BEFORE aggregation,
  // so someone who switched headbands mid-match is one player everywhere — their
  // per-round and cross-round kill streaks stitch across the switch. Keeps the raw
  // name when a headband has no resolved identity (walk-ins).
  if (opts?.identityByHeadband) {
    const resolve = opts.identityByHeadband;
    for (const r of parsed) for (const p of r.players) {
      if (p.headband_no != null) { const n = resolve(p.headband_no); if (n) p.name = n; }
    }
  }

  const acc: Record<string, Acc> = {};
  const A = (id: number, name: string, team: string): Acc =>
    (acc[name] ??= { id, name, team, frags: 0, deaths: 0, hits: 0, shots: 0, wounds: 0, damage: 0, spawnKills: 0, spawnDamage: 0, captures: 0, recaptures: 0, excluded: 0, hold: 0, streakPoints: 0, streaks: {}, roundsPlayed: new Set(), roundsWon: new Set(), onlineRoundsPlayed: new Set() });

  const roundsWonByTeam: Record<string, number> = {};
  const rounds: MatchReportV2["rounds"] = [];
  const teamNames: Record<string, string> = {};
  const teamMembers: Record<string, Set<string>> = {};

  parsed.forEach((r, i) => {
    const ov = rawRounds[i].winnerOverride;
    const winnerTeam = ov === "draw" ? null : (ov || r.result.winner_team);
    // A round with countsAsRound:false (e.g. a game-bugged, prematurely-ended
    // round) still has its player stats aggregated below, but is NOT listed as a
    // scored round and its winner is not tallied — so the match round count and
    // the series score exclude it.
    const countsAsRound = rawRounds[i].countsAsRound !== false;
    if (countsAsRound) {
      rounds.push({ index: rounds.length + 1, winnerTeam, allBasesBurned: r.result.all_bases_burned, durationSeconds: r.meta.duration_seconds });
      if (winnerTeam) roundsWonByTeam[winnerTeam] = (roundsWonByTeam[winnerTeam] ?? 0) + 1;
    }
    for (const t of r.teams) teamNames[t.colour] = t.name;

    const nameOf: Record<number, string> = {};
    for (const p of r.players) { nameOf[p.in_game_player_id] = p.name; (teamMembers[p.team] ??= new Set()).add(p.name); }

    // Death-anchored spawn kills/damage at the configured window.
    const respawns = respawnsFromRaw(rawRounds[i].raw, r.meta.max_hp);
    const lastRes = (v: number, t: number) => { const a = respawns[v] || []; let b: number | null = null; for (const x of a) { if (x <= t) b = x; else break; } return b; };

    for (const p of r.players) {
      const c = r.final_player_counters[p.in_game_player_id]; if (!c) continue;
      const a = A(p.in_game_player_id, p.name, p.team); a.team = p.team; a.id = p.in_game_player_id;
      a.roundsPlayed.add(i); a.onlineRoundsPlayed.add(i); if (countsAsRound && winnerTeam && p.team === winnerTeam) a.roundsWon.add(i);
      a.frags += c.frags; a.deaths += c.deaths; a.hits += c.hits; a.shots += c.shots; a.wounds += c.wounds;
      a.damage += r.damage_dealt[p.in_game_player_id] ?? 0;
    }
    for (const k of r.events.kills) { const t = ep(k.time); const rs = lastRes(k.victim_id, t); if (rs != null && t - rs <= spawnWindowSeconds) { const nm = nameOf[k.actor_id]; if (nm) A(k.actor_id, nm, "").spawnKills++; } }
    for (const dm of r.events.damage) { if (dm.damage <= 0) continue; const t = ep(dm.time); const rs = lastRes(dm.victim_id, t); if (rs != null && t - rs <= spawnWindowSeconds) { const nm = nameOf[dm.actor_id]; if (nm) A(dm.actor_id, nm, "").spawnDamage += dm.damage; } }

    // Effective captures/hold with admin resolutions applied (assign + even
    // split), sub-5s excluded, recaptures. `rr` is the resolution-adjusted round.
    const { round: rr, eff } = effectiveWithResolutions(r, { minHoldSeconds, recaptureWindowSeconds }, rawRounds[i].resolutions);
    for (const p of r.players) { const a = acc[p.name]; if (!a) continue;
      a.captures += eff.captures[p.in_game_player_id] ?? 0;
      a.recaptures += eff.recaptures[p.in_game_player_id] ?? 0;
      a.excluded += eff.excludedCaptures[p.in_game_player_id] ?? 0;
      a.hold += eff.holdSeconds[p.in_game_player_id] ?? 0;
    }

    // Streaks — capture-based streaks respect the <5s exclusion + resolutions.
    const excludedKey = new Set<string>();
    const periodOf = (b: number, f: string) => rr.base_ownership.find((pp) => pp.base_id === b && pp.from_time === f);
    const burnEp: Record<number, number> = {}; for (const b of rr.result.burns) burnEp[b.base_id] = b.burn_epoch;
    for (const cap of rr.events.captures) {
      if (cap.capturing_player_id == null || cap.base_id < 0) continue;
      const per = periodOf(cap.base_id, cap.time); const held = per ? per.held_seconds : 0; const ct = ep(cap.time);
      const toT = per && per.to_time ? ep(per.to_time) : ct + held;
      const burnIn = burnEp[cap.base_id] != null && burnEp[cap.base_id] >= ct - 1 && burnEp[cap.base_id] <= toT + 1;
      if (held < minHoldSeconds && !burnIn) excludedKey.add(`${cap.capturing_player_id}:${cap.base_id}:${cap.time}`);
    }
    const filtered = rr.events.captures.filter((c) => !(c.capturing_player_id != null && c.base_id >= 0 && excludedKey.has(`${c.capturing_player_id}:${c.base_id}:${c.time}`)));
    const rStreak: Round = { ...rr, events: { ...rr.events, captures: filtered } };
    for (const aw of detectStreaks(rStreak)) {
      if (KILL_STREAK_KEYS.has(aw.key)) continue; const pts = streakPointsOf(aw.key); if (!pts) continue; const nm = nameOf[aw.player_id]; if (!nm) continue;
      const a = acc[nm]; if (!a) continue; a.streakPoints += pts; a.streaks[aw.key] = (a.streaks[aw.key] ?? 0) + 1;
    }
  });

  // Kill streaks carry ACROSS rounds (a player who survives keeps their run), so they're
  // detected on the whole match's stitched (headband-resolved) timeline, not per round.
  // Every other streak stays in-round (handled in the loop above).
  for (const aw of detectCrossRoundKillStreaks(parsed)) {
    const pts = streakPointsOf(aw.key);
    if (!pts) continue;
    const a = acc[aw.name];
    if (!a) continue;
    a.streakPoints += pts;
    a.streaks[aw.key] = (a.streaks[aw.key] ?? 0) + 1;
  }

  // Offline rounds (LWA only): per-player kill stats (frags/deaths/hits/shots +
  // pre-estimated damage) add to each player's totals so the kill-score includes
  // them, but they contribute NO objective points and NO streaks. Each supplied
  // winner counts toward the series (the offline export can't split the rounds).
  if (opts?.offline) {
    const m = opts.opsTagByHeadband ?? {};
    const offlineBaseIdx = rounds.length; // offline rounds are appended after the online ones
    for (const [hbStr, st] of Object.entries(opts.offline.statsByHeadband)) {
      const hb = Number(hbStr);
      const name = m[hb] ?? `Head ${hb}`;
      const a = A(-hb, name, st.team); // existing online player keeps their team
      a.frags += st.frags; a.deaths += st.deaths; a.hits += st.hits; a.shots += st.shots; a.damage += st.damage; a.wounds += st.wounds ?? 0;
      opts.offline.roundWinners.forEach((w, k) => { a.roundsPlayed.add(offlineBaseIdx + k); if (w && w === st.team) a.roundsWon.add(offlineBaseIdx + k); });
      (teamMembers[a.team] ??= new Set()).add(name);
    }
    for (const w of opts.offline.roundWinners) {
      rounds.push({ index: rounds.length + 1, winnerTeam: w ?? null, allBasesBurned: false, durationSeconds: 0 });
      if (w) roundsWonByTeam[w] = (roundsWonByTeam[w] ?? 0) + 1;
    }
  }

  const killMatrix = buildKillMatrix(parsed);

  // Assemble per-player reports + scores.
  const players: PlayerReport[] = Object.values(acc).map((a) => {
    const f = Math.max(0, a.frags - a.spawnKills);
    const dmg = Math.max(0, a.damage - a.spawnDamage);
    const accuracy = a.shots > 0 ? a.hits / a.shots : 0;
    const kd = a.deaths > 0 ? f / a.deaths : f;
    // Scores come from the admin formula when provided: each group is objective
    // if it uses an objective stat, else kill. Recaptures are not a formula stat
    // (their points live in exploit control), so they are added to the objective
    // total separately. Kill rounds; objective ceils so team ratings stay integer
    // even with fractional hold weights (x1.5).
    const statVals = { frags: f, damage: dmg, accuracy, kd, captures: a.captures, hold: a.hold, recaptures: a.recaptures };
    let killScore: number;
    let objectiveScore: number;
    if (formula) {
      let killV = 0;
      let objV = 0;
      for (const g of formula.groups) {
        const isObj = [...g.baseTerms, ...g.multipliers].some(
          (t) => t.stat === "captures" || t.stat === "hold" || t.stat === "recaptures",
        );
        const v = computeGroupValue(g, statVals);
        if (isObj) objV += v;
        else killV += v;
      }
      killScore = Math.round(killV);
      objectiveScore = Math.ceil(objV + a.recaptures * recapturePoints);
    } else {
      killScore = Math.round((f * 50 + dmg * 0.2) * (1 + accuracy * 0.2) * (1 + kd * 0.12));
      objectiveScore = Math.ceil(a.captures * capturePoints + a.recaptures * recapturePoints + a.hold * holdPerSecond);
    }
    const streakScore = a.streakPoints;
    const streaks: PlayerStreak[] = Object.entries(a.streaks)
      .map(([key, count]) => ({ key, name: streakNameOf(key), count, points: streakPointsOf(key) * count }))
      .sort((x, y) => y.points - x.points);
    const pp = killMatrix.perPlayer[a.name] ?? { killed: [], killedBy: [], nemesis: null };
    return {
      id: a.id, name: a.name, team: a.team, frags: f, deaths: a.deaths, kd: Math.round(kd * 100) / 100,
      accuracy: Math.round(accuracy * 1000) / 1000, shots: a.shots, hits: a.hits, wounds: a.wounds, damage: dmg,
      spawnKills: a.spawnKills, spawnDamage: a.spawnDamage, captures: a.captures, recaptures: a.recaptures, excludedCaptures: a.excluded, holdSeconds: a.hold,
      roundsPlayed: a.roundsPlayed.size, roundsWonPresent: a.roundsWon.size, onlineRoundsPlayed: a.onlineRoundsPlayed.size,
      killScore, objectiveScore, streakScore, totalScore: killScore + objectiveScore + streakScore,
      streaks, accolades: [], killed: pp.killed, killedBy: pp.killedBy, nemesis: pp.nemesis,
    };
  }).sort((a, b) => b.totalScore - a.totalScore);

  // Accolades over the assembled stats (XP-only, so computed after scores).
  const accoladeStats = players.map((p) => ({
    id: p.id, name: p.name, team: p.team, score: p.totalScore, frags: p.frags, deaths: p.deaths,
    kd: p.kd, shots: p.shots, hits: p.hits, accuracy: p.accuracy, wounds: p.wounds, damage: p.damage,
    captures: p.captures + p.recaptures, holdSeconds: p.holdSeconds,
  }));
  const accolades = computeAccolades(accoladeStats);
  const wonBy: Record<number, string[]> = {};
  for (const aw of accolades) (wonBy[aw.winnerId] ??= []).push(aw.name);
  for (const p of players) p.accolades = wonBy[p.id] ?? [];

  const teams = Object.keys(teamMembers).sort().map((colour) => ({
    colour, name: teamNames[colour] ?? colour, roundsWon: roundsWonByTeam[colour] ?? 0,
    playerNames: [...teamMembers[colour]].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
  }));
  const matchWinner = Object.entries(roundsWonByTeam).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    matchId: meta.matchId, label: meta.label, date: meta.date ?? (parsed[0]?.meta.start_time ?? null),
    roundCount: rounds.length, rounds, teams, matchWinner, roundsWonByTeam, players, accolades, killMatrix,
    generatedAt: new Date().toISOString(),
  };
}
