/**
 * lib/ingestion/streaks.ts
 * --------------------------------------------------------------------
 * Layer B: detect streaks from a parsed Round (Pack 2 §7). Pure – consumes the
 * facts from round-parser, computes nothing about ELO/XP/score. A streak can
 * fire multiple times per round (once per life), but kill-streak tiers are
 * mutually exclusive per life – only the highest tier a run reaches fires.
 * Canonical keys here map to the admin's streak_definitions (names/points) at
 * commit. Burn-based streaks are PROVISIONAL until validated on a real burn game.
 */
import type { Round } from "@/lib/ingestion/round-parser";

export type StreakAward = {
  player_id: number;
  key: string;
  name: string;
  time: string;
  detail?: string;
};

export const STREAK_NAMES: Record<string, string> = {
  kill_streak_3: "3 Piece",
  kill_streak_5: "5 Piece",
  kill_streak_10: "10 Piece",
  kill_streak_20: "20 Piece",
  first_blood: "First Blood",
  last_blood: "Last Blood",
  survivor: "Survivor",
  clutch_move: "Clutch Move",
  ptfo: "PTFO",
  map_domination: "Map Domination",
  clean_sweep: "Clean Sweep",
  grim_reaper: "Grim Reaper",
  streak_ender: "Streak Ender",
  bully: "Bully",
  hold_base_3min: "Hold 3 min",
  hold_base_5min: "Hold 5 min",
  hold_base_10min: "Hold 10 min",
  captures_3: "3 Captures",
  captures_5: "5 Captures",
  captures_10: "10 Captures",
  burner_1: "Burner",
  burner_2: "2x Burner",
  shadow: "Shadow",
};

function toEpoch(t: string): number {
  const ms = Date.parse(t.replace(/\./g, "-").replace(" ", "T"));
  return Number.isNaN(ms) ? NaN : Math.floor(ms / 1000);
}

const SURVIVOR_HP = 50;
const CLUTCH_WINDOW = 30;

export function detectStreaks(round: Round): StreakAward[] {
  const out: StreakAward[] = [];
  const add = (player_id: number, key: string, time: string, detail?: string) =>
    out.push({ player_id, key, name: STREAK_NAMES[key] ?? key, time, detail });

  const kills = round.events.kills
    .map((k) => ({ ...k, epoch: toEpoch(k.time) }))
    .sort((a, b) => a.epoch - b.epoch);
  const captures = round.events.captures
    .filter((c) => c.capturing_player_id != null)
    .map((c) => ({ ...c, epoch: toEpoch(c.time), pid: c.capturing_player_id as number }))
    .sort((a, b) => a.epoch - b.epoch);

  const playerIds = round.players.map((p) => p.in_game_player_id);
  const teamOf = new Map(round.players.map((p) => [p.in_game_player_id, p.team]));

  // Deaths per player (victim), sorted – used for "in one life" grouping.
  const deaths = new Map<number, number[]>();
  for (const pid of playerIds) deaths.set(pid, []);
  for (const k of kills) deaths.get(k.victim_id)?.push(k.epoch);
  const lifeIndex = (pid: number, epoch: number): number => {
    const d = deaths.get(pid) ?? [];
    let n = 0;
    for (const e of d) if (e < epoch) n++;
    return n;
  };

  // --- Kill streaks (3/5/10/20): consecutive kills with no death between -----
  // Only the highest tier reached in a single life fires – a 6-kill life gives a
  // 5-Streak, not a 3-Streak too. Across separate lives each fires again.
  const KILL_TIERS = [[3, "kill_streak_3"], [5, "kill_streak_5"], [10, "kill_streak_10"], [20, "kill_streak_20"]] as const;
  for (const pid of playerIds) {
    const stream = [
      ...kills.filter((k) => k.actor_id === pid).map((k) => ({ epoch: k.epoch, time: k.time, kill: true })),
      ...kills.filter((k) => k.victim_id === pid).map((k) => ({ epoch: k.epoch, time: k.time, kill: false })),
    ].sort((a, b) => a.epoch - b.epoch || (a.kill === b.kill ? 0 : a.kill ? -1 : 1));
    let run = 0;
    const times: Record<number, string> = {};
    const flush = () => {
      for (let i = KILL_TIERS.length - 1; i >= 0; i--) {
        const [n, key] = KILL_TIERS[i];
        if (run >= n) {
          add(pid, key, times[n]);
          break;
        }
      }
      run = 0;
    };
    for (const ev of stream) {
      if (ev.kill) {
        run++;
        times[run] = ev.time;
      } else flush();
    }
    flush();
  }

  // --- First / Last blood ---------------------------------------------------
  if (kills.length > 0) {
    add(kills[0].actor_id, "first_blood", kills[0].time);
    const last = kills[kills.length - 1];
    add(last.actor_id, "last_blood", last.time);
  }

  // --- Survivor: 3 kills at <=50 HP within one life -------------------------
  {
    const perLife = new Map<string, number>(); // `${pid}:${life}` -> low-hp kill count
    for (const k of kills) {
      if (k.actor_hp == null || k.actor_hp > SURVIVOR_HP) continue;
      const key = `${k.actor_id}:${lifeIndex(k.actor_id, k.epoch)}`;
      const c = (perLife.get(key) ?? 0) + 1;
      perLife.set(key, c);
      if (c === 3) add(k.actor_id, "survivor", k.time);
    }
  }

  // --- Streak Ender: kill a player currently on a >=5 kill streak ------------
  {
    const live = new Map<number, number>();
    for (const pid of playerIds) live.set(pid, 0);
    for (const k of kills) {
      if ((live.get(k.victim_id) ?? 0) >= 5) add(k.actor_id, "streak_ender", k.time, `ended ${k.victim_id}`);
      live.set(k.actor_id, (live.get(k.actor_id) ?? 0) + 1);
      live.set(k.victim_id, 0);
    }
  }

  // --- Bully: kill the same opponent 10 times -------------------------------
  {
    const pair = new Map<string, number>();
    for (const k of kills) {
      const key = `${k.actor_id}:${k.victim_id}`;
      const c = (pair.get(key) ?? 0) + 1;
      pair.set(key, c);
      if (c === 10) add(k.actor_id, "bully", k.time, `on ${k.victim_id}`);
    }
  }

  // --- Clean Sweep / Grim Reaper -------------------------------------------
  for (const pid of playerIds) {
    const opponents = playerIds.filter((o) => o !== pid && teamOf.get(o) !== teamOf.get(pid));
    if (opponents.length === 0) continue;
    // Clean sweep: distinct opponents killed across the whole round.
    const roundVictims = new Set<number>();
    let sweepDone = false;
    for (const k of kills.filter((x) => x.actor_id === pid)) {
      roundVictims.add(k.victim_id);
      if (!sweepDone && opponents.every((o) => roundVictims.has(o))) {
        add(pid, "clean_sweep", k.time);
        sweepDone = true;
      }
    }
    // Grim reaper: all opponents within a single life.
    const perLife = new Map<number, Set<number>>();
    for (const k of kills.filter((x) => x.actor_id === pid)) {
      const li = lifeIndex(pid, k.epoch);
      if (!perLife.has(li)) perLife.set(li, new Set());
      const s = perLife.get(li)!;
      const already = opponents.every((o) => s.has(o));
      s.add(k.victim_id);
      if (!already && opponents.every((o) => s.has(o))) add(pid, "grim_reaper", k.time);
    }
  }

  // --- Clutch Move: >=2 kills and a capture within 30s ----------------------
  for (const pid of playerIds) {
    const evs = [
      ...kills.filter((k) => k.actor_id === pid).map((k) => ({ epoch: k.epoch, time: k.time, cap: false })),
      ...captures.filter((c) => c.pid === pid).map((c) => ({ epoch: c.epoch, time: c.time, cap: true })),
    ].sort((a, b) => a.epoch - b.epoch);
    let done = false;
    for (let i = 0; i < evs.length && !done; i++) {
      const window = evs.filter((e) => e.epoch >= evs[i].epoch && e.epoch <= evs[i].epoch + CLUTCH_WINDOW);
      const k = window.filter((e) => !e.cap).length;
      const c = window.filter((e) => e.cap).length;
      if (k >= 2 && c >= 1) {
        add(pid, "clutch_move", window[window.length - 1].time);
        done = true;
      }
    }
  }

  // --- Objective: captures thresholds, PTFO, Map Domination -----------------
  for (const pid of playerIds) {
    const mine = captures.filter((c) => c.pid === pid);
    mine.forEach((c, i) => {
      const n = i + 1;
      if (n === 3) add(pid, "captures_3", c.time);
      if (n === 5) add(pid, "captures_5", c.time);
      if (n === 10) add(pid, "captures_10", c.time);
    });
    // distinct bases within a life
    const perLife = new Map<number, Set<number>>();
    for (const c of mine) {
      const li = lifeIndex(pid, c.epoch);
      if (!perLife.has(li)) perLife.set(li, new Set());
      const s = perLife.get(li)!;
      const before = s.size;
      s.add(c.base_id);
      if (before < 2 && s.size === 2) add(pid, "ptfo", c.time);
      if (before < 3 && s.size === 3) add(pid, "map_domination", c.time);
    }
  }

  // --- Shadow: survive the whole round (0 deaths) with >=5 kills ------------
  for (const pid of playerIds) {
    const myKills = kills.filter((k) => k.actor_id === pid);
    if ((deaths.get(pid)?.length ?? 0) === 0 && myKills.length >= 5) {
      add(pid, "shadow", myKills[myKills.length - 1].time);
    }
  }

  // --- Hold-base streaks (continuous hold by the capturer) ------------------
  for (const period of round.base_ownership) {
    const cap = round.events.captures.find(
      (c) => c.base_id === period.base_id && c.time === period.from_time && c.capturing_player_id != null,
    );
    if (cap?.capturing_player_id == null) continue;
    const pid = cap.capturing_player_id;
    // Tiers are mutually exclusive: a single continuous hold fires only its
    // highest tier (a 10-min hold is not also a 5- and 3-min). Separate holds
    // each still fire their own tier.
    if (period.held_seconds >= 600) add(pid, "hold_base_10min", period.from_time, `base ${period.base_id}`);
    else if (period.held_seconds >= 300) add(pid, "hold_base_5min", period.from_time, `base ${period.base_id}`);
    else if (period.held_seconds >= 180) add(pid, "hold_base_3min", period.from_time, `base ${period.base_id}`);
  }

  // --- Burner: cumulative team hold per base reaches 600s (PROVISIONAL) ------
  {
    const burnsByPlayer = new Map<number, number>();
    const byBase = new Map<number, typeof round.base_ownership>();
    for (const p of round.base_ownership) {
      if (!byBase.has(p.base_id)) byBase.set(p.base_id, []);
      byBase.get(p.base_id)!.push(p);
    }
    for (const [baseId, periods] of byBase) {
      const sorted = [...periods].sort((a, b) => toEpoch(a.from_time) - toEpoch(b.from_time));
      const teamTotal = new Map<string, number>();
      const burnedTeam = new Set<string>();
      for (const period of sorted) {
        if (burnedTeam.has(period.team)) continue;
        const prev = teamTotal.get(period.team) ?? 0;
        const total = prev + period.held_seconds;
        teamTotal.set(period.team, total);
        if (total >= 600) {
          burnedTeam.add(period.team);
          const cap = round.events.captures.find(
            (c) => c.base_id === baseId && c.time === period.from_time && c.capturing_player_id != null,
          );
          if (cap?.capturing_player_id != null) {
            const pid = cap.capturing_player_id;
            const n = (burnsByPlayer.get(pid) ?? 0) + 1;
            burnsByPlayer.set(pid, n);
            if (n === 1) add(pid, "burner_1", period.from_time, `base ${baseId}`);
            if (n === 2) add(pid, "burner_2", period.from_time, `base ${baseId}`);
          }
        }
      }
    }
  }

  return out;
}

/** Kill-streak keys — detected ACROSS rounds (see detectCrossRoundKillStreaks), not per round. */
export const KILL_STREAK_KEYS = new Set(["kill_streak_3", "kill_streak_5", "kill_streak_10", "kill_streak_20"]);

// Highest-first so each run is credited only its top tier (tiers are mutually exclusive).
const KILL_STREAK_TIERS: { key: string; min: number }[] = [
  { key: "kill_streak_20", min: 20 },
  { key: "kill_streak_10", min: 10 },
  { key: "kill_streak_5", min: 5 },
  { key: "kill_streak_3", min: 3 },
];

/**
 * Cross-round kill streaks. A kill streak is N kills in a row without dying, and
 * unlike every other streak it CARRIES ACROSS ROUNDS: a player who survives a round
 * keeps their run into the next one. Each person's kills + deaths are stitched across
 * all (online) rounds by their (headband-resolved) NAME — so a headband switch between
 * rounds does not break the run — ordered chronologically (round, then time), and the
 * run is walked: a death anywhere breaks it, a round boundary does not. Each maximal run
 * is credited its single highest tier; a player can earn several across a match.
 * Returns awards keyed by player name.
 */
export function detectCrossRoundKillStreaks(rounds: Round[]): { name: string; key: string }[] {
  type Ev = { round: number; epoch: number; kill: boolean };
  const streams = new Map<string, Ev[]>();
  const add = (name: string, e: Ev) => {
    if (!name) return;
    const cur = streams.get(name);
    if (cur) cur.push(e);
    else streams.set(name, [e]);
  };
  rounds.forEach((r, ri) => {
    const nameOf: Record<number, string> = {};
    for (const pl of r.players) nameOf[pl.in_game_player_id] = pl.name;
    for (const k of r.events.kills) {
      const epoch = toEpoch(k.time);
      add(nameOf[k.actor_id], { round: ri, epoch, kill: true }); // a kill for the actor
      add(nameOf[k.victim_id], { round: ri, epoch, kill: false }); // a death for the victim
    }
  });

  const awards: { name: string; key: string }[] = [];
  for (const [name, evs] of streams) {
    // Chronological: by round, then time; on a tie a kill counts before a death.
    evs.sort((a, b) => a.round - b.round || a.epoch - b.epoch || (a.kill === b.kill ? 0 : a.kill ? -1 : 1));
    let run = 0;
    const flush = () => {
      if (run >= 3) {
        const tier = KILL_STREAK_TIERS.find((t) => run >= t.min);
        if (tier) awards.push({ name, key: tier.key });
      }
      run = 0;
    };
    for (const e of evs) {
      if (e.kill) run++;
      else flush();
    }
    flush();
  }
  return awards;
}
