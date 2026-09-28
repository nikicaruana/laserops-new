/**
 * lib/ingestion/streak-engine.ts
 * --------------------------------------------------------------------
 * Data-driven streak engine. A streak is defined by a RULE (composable
 * building blocks); one generic evaluator runs any rule against the parsed
 * round facts. This is what makes streaks fully configurable (resell-ready) –
 * the 23 built-ins are just seed configs (BUILTIN_STREAK_RULES), not code.
 *
 * The hardcoded lib/ingestion/streaks.ts stays as the reference oracle: the
 * verify script asserts this engine reproduces it on the fixture.
 */
import type { Round } from "@/lib/ingestion/round-parser";

// --- Rule building blocks --------------------------------------------------

// How often a streak may be awarded to the same player in one round. Applies to
// EVERY rule kind as a final cap: "per_life" keeps only the first award in each
// life, "per_round" only the first in the whole round. Omit/null = uncapped
// (a streak may fire every time its rule is satisfied). Several streaks read
// best as once-per-life achievements, so this is the toggle for that.
export type StreakLimit = "per_life" | "per_round";

export type StreakRuleConfig = StreakRuleVariant & { limit?: StreakLimit | null };

type StreakRuleVariant =
  // N of `event` in a row, reset by any `reset_on` event (kill streaks).
  // `up_to` caps the tier: a run fires this streak only if it reaches `count`
  // but stays BELOW `up_to` (the next tier). This makes the tiers mutually
  // exclusive per run, so one life awards only the highest tier reached (a
  // 6-kill life gives a 5-Streak, not a 3-Streak AND a 5-Streak). Omit/null =
  // no upper bound (the top tier).
  | { kind: "consecutive"; event: EventName; count: number; reset_on: EventName[]; up_to?: number | null }
  // N of `event` within a scope, optionally only when the actor's HP <= cap.
  | { kind: "count"; event: EventName; count: number; scope: Scope; actor_hp_max?: number | null }
  // N DISTINCT `distinct_by` values captured/killed within a scope.
  | { kind: "distinct"; event: EventName; count: number; scope: Scope; distinct_by: "base" | "victim" }
  // N of `event` against the SAME single target within a scope (Bully).
  | { kind: "per_target"; event: EventName; count: number; scope: Scope; target: "victim" }
  | { kind: "first_of"; event: EventName }
  | { kind: "last_of"; event: EventName }
  // Cover every member of a set (all opponents) via `event` within a scope.
  | { kind: "cover_set"; event: EventName; set: "opponents"; scope: Scope }
  // `event` whose victim is currently on a kill streak >= min_streak.
  | { kind: "victim_streak"; event: EventName; min_streak: number }
  // All `requirements` met within a rolling window (Clutch Move).
  | { kind: "combo_window"; window_seconds: number; requirements: { event: EventName; count: number }[] }
  // A continuous base hold of >= min_seconds, credited to the capturer.
  | { kind: "hold_duration"; min_seconds: number; up_to?: number | null }
  // Burn `count` bases (advanced: cumulative per-team hold reaches 10 min).
  | { kind: "burn"; count: number }
  // Survive the whole round (0 deaths) with >= require_count of require_event.
  | { kind: "survive_round"; require_event: EventName; require_count: number }
  // Kill the player who most recently killed you (Revenge). Each avenged killer
  // fires once; the actor must be killed again before it can fire on them anew.
  | { kind: "revenge" }
  // Get a kill after dying `deaths_required` times in a row with no kills in
  // between (Redemption). The redeeming kill resets the death run.
  | { kind: "redemption"; deaths_required: number };

export type EventName = "kill" | "capture" | "death";
export type Scope = "round" | "life";

export type StreakDef = { key: string; name: string; rule: StreakRuleConfig };
export type StreakAward = { player_id: number; key: string; name: string; time: string; detail?: string };

// --- The 23 built-ins as configs -------------------------------------------

export const BUILTIN_STREAK_RULES: Record<string, StreakRuleConfig> = {
  kill_streak_3: { kind: "consecutive", event: "kill", count: 3, reset_on: ["death"], up_to: 5 },
  kill_streak_5: { kind: "consecutive", event: "kill", count: 5, reset_on: ["death"], up_to: 10 },
  kill_streak_10: { kind: "consecutive", event: "kill", count: 10, reset_on: ["death"], up_to: 20 },
  kill_streak_20: { kind: "consecutive", event: "kill", count: 20, reset_on: ["death"], up_to: null },
  survivor: { kind: "count", event: "kill", count: 3, scope: "life", actor_hp_max: 50 },
  first_blood: { kind: "first_of", event: "kill" },
  last_blood: { kind: "last_of", event: "kill" },
  clutch_move: { kind: "combo_window", window_seconds: 30, requirements: [{ event: "kill", count: 2 }, { event: "capture", count: 1 }] },
  ptfo: { kind: "distinct", event: "capture", count: 2, scope: "life", distinct_by: "base" },
  map_domination: { kind: "distinct", event: "capture", count: 3, scope: "life", distinct_by: "base" },
  clean_sweep: { kind: "cover_set", event: "kill", set: "opponents", scope: "round" },
  grim_reaper: { kind: "cover_set", event: "kill", set: "opponents", scope: "life" },
  streak_ender: { kind: "victim_streak", event: "kill", min_streak: 5 },
  bully: { kind: "per_target", event: "kill", count: 10, scope: "round", target: "victim" },
  hold_base_3min: { kind: "hold_duration", min_seconds: 180, up_to: 300 },
  hold_base_5min: { kind: "hold_duration", min_seconds: 300, up_to: 600 },
  hold_base_10min: { kind: "hold_duration", min_seconds: 600, up_to: null },
  captures_3: { kind: "count", event: "capture", count: 3, scope: "round" },
  captures_5: { kind: "count", event: "capture", count: 5, scope: "round" },
  captures_10: { kind: "count", event: "capture", count: 10, scope: "round" },
  burner_1: { kind: "burn", count: 1 },
  burner_2: { kind: "burn", count: 2 },
  shadow: { kind: "survive_round", require_event: "kill", require_count: 5 },
};

// --- Shared derived facts --------------------------------------------------

function toEpoch(t: string): number {
  const ms = Date.parse(t.replace(/\./g, "-").replace(" ", "T"));
  return Number.isNaN(ms) ? NaN : Math.floor(ms / 1000);
}

type Ctx = ReturnType<typeof buildContext>;

function buildContext(round: Round) {
  const kills = round.events.kills
    .map((k) => ({ ...k, epoch: toEpoch(k.time) }))
    .sort((a, b) => a.epoch - b.epoch);
  const captures = round.events.captures
    .filter((c) => c.capturing_player_id != null)
    .map((c) => ({ time: c.time, epoch: toEpoch(c.time), pid: c.capturing_player_id as number, base_id: c.base_id }))
    .sort((a, b) => a.epoch - b.epoch);
  const playerIds = round.players.map((p) => p.in_game_player_id);
  const teamOf = new Map(round.players.map((p) => [p.in_game_player_id, p.team]));
  const deaths = new Map<number, number[]>();
  for (const pid of playerIds) deaths.set(pid, []);
  for (const k of kills) deaths.get(k.victim_id)?.push(k.epoch);
  const lifeIndex = (pid: number, epoch: number) => (deaths.get(pid) ?? []).filter((e) => e < epoch).length;
  const opponents = (pid: number) => playerIds.filter((o) => o !== pid && teamOf.get(o) !== teamOf.get(pid));
  return { round, kills, captures, playerIds, teamOf, deaths, lifeIndex, opponents };
}

/** A player's own stream of a named event, as [{epoch, time, actor_hp?}]. */
function eventsFor(ctx: Ctx, pid: number, event: EventName) {
  if (event === "kill") return ctx.kills.filter((k) => k.actor_id === pid).map((k) => ({ epoch: k.epoch, time: k.time, actor_hp: k.actor_hp, target: k.victim_id }));
  if (event === "death") return ctx.kills.filter((k) => k.victim_id === pid).map((k) => ({ epoch: k.epoch, time: k.time, actor_hp: null, target: k.actor_id }));
  return ctx.captures.filter((c) => c.pid === pid).map((c) => ({ epoch: c.epoch, time: c.time, actor_hp: null, target: c.base_id }));
}

// --- Evaluator -------------------------------------------------------------

export function evaluateStreaks(round: Round, defs: StreakDef[]): StreakAward[] {
  const ctx = buildContext(round);
  const out: StreakAward[] = [];
  for (const def of defs) {
    for (const hit of runRule(ctx, def.rule)) {
      out.push({ player_id: hit.player_id, key: def.key, name: def.name, time: hit.time, detail: hit.detail });
    }
  }
  return out;
}

/** Convenience: evaluate the built-in set (keys -> names via nameFn). */
export function evaluateBuiltins(round: Round, nameFor: (key: string) => string): StreakAward[] {
  const defs: StreakDef[] = Object.entries(BUILTIN_STREAK_RULES).map(([key, rule]) => ({ key, name: nameFor(key), rule }));
  return evaluateStreaks(round, defs);
}

type Hit = { player_id: number; time: string; detail?: string };

/** Keep only the first award per player per life (or per round). */
function applyLimit(ctx: Ctx, hits: Hit[], limit: StreakLimit): Hit[] {
  const seen = new Set<string>();
  const out: Hit[] = [];
  for (const h of [...hits].sort((a, b) => toEpoch(a.time) - toEpoch(b.time))) {
    const key = limit === "per_round" ? `${h.player_id}` : `${h.player_id}:${ctx.lifeIndex(h.player_id, toEpoch(h.time))}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

function runRule(ctx: Ctx, rule: StreakRuleConfig): Hit[] {
  const hits: Hit[] = [];
  const emit = (player_id: number, time: string, detail?: string) => hits.push({ player_id, time, detail });

  switch (rule.kind) {
    case "consecutive": {
      for (const pid of ctx.playerIds) {
        const stream = [
          ...eventsFor(ctx, pid, rule.event).map((e) => ({ epoch: e.epoch, time: e.time, hit: true })),
          ...rule.reset_on.flatMap((r) => eventsFor(ctx, pid, r).map((e) => ({ epoch: e.epoch, time: e.time, hit: false }))),
        ].sort((a, b) => a.epoch - b.epoch || (a.hit === b.hit ? 0 : a.hit ? -1 : 1));
        // Walk each maximal run of consecutive events (a run ends at a reset,
        // i.e. a life). Record when the `count`-th event landed, then at the
        // end of the run fire only if the run peaked in this tier's band
        // [count, up_to) – so a life awards its single highest tier, not every
        // tier it passed through.
        let run = 0;
        let reachedTime: string | null = null;
        const flush = () => {
          if (run >= rule.count && (rule.up_to == null || run < rule.up_to) && reachedTime) {
            emit(pid, reachedTime);
          }
          run = 0;
          reachedTime = null;
        };
        for (const ev of stream) {
          if (ev.hit) {
            run++;
            if (run === rule.count) reachedTime = ev.time;
          } else flush();
        }
        flush();
      }
      break;
    }
    case "count": {
      for (const pid of ctx.playerIds) {
        let evs = eventsFor(ctx, pid, rule.event);
        if (rule.actor_hp_max != null) evs = evs.filter((e) => e.actor_hp != null && e.actor_hp <= rule.actor_hp_max!);
        if (rule.scope === "round") {
          if (evs.length >= rule.count) emit(pid, evs[rule.count - 1].time);
        } else {
          const perLife = new Map<number, number>();
          for (const e of evs) {
            const li = ctx.lifeIndex(pid, e.epoch);
            const c = (perLife.get(li) ?? 0) + 1;
            perLife.set(li, c);
            if (c === rule.count) emit(pid, e.time);
          }
        }
      }
      break;
    }
    case "distinct": {
      for (const pid of ctx.playerIds) {
        const evs = eventsFor(ctx, pid, rule.event);
        const groups = new Map<number, Set<number>>(); // scope-group -> distinct targets
        for (const e of evs) {
          const g = rule.scope === "round" ? 0 : ctx.lifeIndex(pid, e.epoch);
          if (!groups.has(g)) groups.set(g, new Set());
          const s = groups.get(g)!;
          const before = s.size;
          s.add(e.target);
          if (before < rule.count && s.size === rule.count) emit(pid, e.time);
        }
      }
      break;
    }
    case "per_target": {
      for (const pid of ctx.playerIds) {
        const evs = eventsFor(ctx, pid, rule.event);
        const counts = new Map<string, number>(); // `${group}:${target}`
        for (const e of evs) {
          const g = rule.scope === "round" ? 0 : ctx.lifeIndex(pid, e.epoch);
          const k = `${g}:${e.target}`;
          const c = (counts.get(k) ?? 0) + 1;
          counts.set(k, c);
          if (c === rule.count) emit(pid, e.time, `on ${e.target}`);
        }
      }
      break;
    }
    case "first_of": {
      if (ctx.kills.length > 0 && rule.event === "kill") emit(ctx.kills[0].actor_id, ctx.kills[0].time);
      break;
    }
    case "last_of": {
      if (ctx.kills.length > 0 && rule.event === "kill") {
        const last = ctx.kills[ctx.kills.length - 1];
        emit(last.actor_id, last.time);
      }
      break;
    }
    case "cover_set": {
      for (const pid of ctx.playerIds) {
        const opps = ctx.opponents(pid);
        if (opps.length === 0) continue;
        const evs = eventsFor(ctx, pid, rule.event);
        const groups = new Map<number, Set<number>>();
        for (const e of evs) {
          const g = rule.scope === "round" ? 0 : ctx.lifeIndex(pid, e.epoch);
          if (!groups.has(g)) groups.set(g, new Set());
          const s = groups.get(g)!;
          const already = opps.every((o) => s.has(o));
          s.add(e.target);
          if (!already && opps.every((o) => s.has(o))) emit(pid, e.time);
        }
      }
      break;
    }
    case "victim_streak": {
      const live = new Map<number, number>();
      for (const pid of ctx.playerIds) live.set(pid, 0);
      for (const k of ctx.kills) {
        if ((live.get(k.victim_id) ?? 0) >= rule.min_streak) emit(k.actor_id, k.time, `ended ${k.victim_id}`);
        live.set(k.actor_id, (live.get(k.actor_id) ?? 0) + 1);
        live.set(k.victim_id, 0);
      }
      break;
    }
    case "combo_window": {
      for (const pid of ctx.playerIds) {
        const evs = rule.requirements
          .flatMap((req) => eventsFor(ctx, pid, req.event).map((e) => ({ epoch: e.epoch, time: e.time, event: req.event })))
          .sort((a, b) => a.epoch - b.epoch);
        for (let i = 0; i < evs.length; i++) {
          const win = evs.filter((e) => e.epoch >= evs[i].epoch && e.epoch <= evs[i].epoch + rule.window_seconds);
          if (rule.requirements.every((req) => win.filter((e) => e.event === req.event).length >= req.count)) {
            emit(pid, win[win.length - 1].time);
            break;
          }
        }
      }
      break;
    }
    case "hold_duration": {
      for (const period of ctx.round.base_ownership) {
        if (period.held_seconds < rule.min_seconds) continue;
        if (rule.up_to != null && period.held_seconds >= rule.up_to) continue; // a higher tier owns this hold
        const cap = ctx.round.events.captures.find(
          (c) => c.base_id === period.base_id && c.time === period.from_time && c.capturing_player_id != null,
        );
        if (cap?.capturing_player_id != null) emit(cap.capturing_player_id, period.from_time, `base ${period.base_id}`);
      }
      break;
    }
    case "burn": {
      const burns = new Map<number, number>();
      const byBase = new Map<number, typeof ctx.round.base_ownership>();
      for (const p of ctx.round.base_ownership) {
        if (!byBase.has(p.base_id)) byBase.set(p.base_id, []);
        byBase.get(p.base_id)!.push(p);
      }
      for (const [baseId, periods] of byBase) {
        const sorted = [...periods].sort((a, b) => toEpoch(a.from_time) - toEpoch(b.from_time));
        const teamTotal = new Map<string, number>();
        const burned = new Set<string>();
        for (const period of sorted) {
          if (burned.has(period.team)) continue;
          const total = (teamTotal.get(period.team) ?? 0) + period.held_seconds;
          teamTotal.set(period.team, total);
          if (total >= 600) {
            burned.add(period.team);
            const cap = ctx.round.events.captures.find(
              (c) => c.base_id === baseId && c.time === period.from_time && c.capturing_player_id != null,
            );
            if (cap?.capturing_player_id != null) {
              const n = (burns.get(cap.capturing_player_id) ?? 0) + 1;
              burns.set(cap.capturing_player_id, n);
              if (n === rule.count) emit(cap.capturing_player_id, period.from_time, `base ${baseId}`);
            }
          }
        }
      }
      break;
    }
    case "survive_round": {
      for (const pid of ctx.playerIds) {
        const evs = eventsFor(ctx, pid, rule.require_event);
        if ((ctx.deaths.get(pid)?.length ?? 0) === 0 && evs.length >= rule.require_count) {
          emit(pid, evs[evs.length - 1].time);
        }
      }
      break;
    }
    case "revenge": {
      // Walk kills in time order tracking each player's most recent killer.
      // When a player kills that exact person, it's a revenge (then cleared so
      // they must be killed again before avenging the same player anew).
      const lastKiller = new Map<number, number>(); // victim -> who last killed them
      for (const k of ctx.kills) {
        if (lastKiller.get(k.actor_id) === k.victim_id) {
          emit(k.actor_id, k.time, `on ${k.victim_id}`);
          lastKiller.delete(k.actor_id);
        }
        lastKiller.set(k.victim_id, k.actor_id);
      }
      break;
    }
    case "redemption": {
      // Per player: consecutive deaths with no kills in between. A kill while
      // that run is >= deaths_required redeems; the kill resets the run.
      const deathRun = new Map<number, number>(); // player -> deaths since their last kill
      for (const k of ctx.kills) {
        if ((deathRun.get(k.actor_id) ?? 0) >= rule.deaths_required) emit(k.actor_id, k.time);
        deathRun.set(k.actor_id, 0); // the actor got a kill
        deathRun.set(k.victim_id, (deathRun.get(k.victim_id) ?? 0) + 1); // the victim died
      }
      break;
    }
  }
  return rule.limit ? applyLimit(ctx, hits, rule.limit) : hits;
}
