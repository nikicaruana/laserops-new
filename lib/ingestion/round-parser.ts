/**
 * lib/ingestion/round-parser.ts
 * --------------------------------------------------------------------
 * Layer A of the LaserOps round ingestion: turn ONE LaserWar/Alphatag online
 * game JSON file (one round, JSONL) into clean, structured per-player / per-base
 * facts. Pure fact-extraction — NO ELO / XP / score / streak logic (those
 * consume this output). Built to the ground-truth spec:
 *   docs/ingestion/LaserOps_JSON_Parsing_Pack_2.md
 *
 * Defensive by design (per the spec's hard-won rules):
 *  - JSONL, one object per line; tolerate blanks + a malformed final line.
 *  - GameEnd may have no `Item` — guard everywhere.
 *  - File is NOT globally time-sorted (devices buffer offline) — all timing
 *    logic sorts per player/base by EventTime first; never trust line order.
 *  - Whole-second timestamps.
 *  - FieldDeviceEvent.PlayerId is a BASE id, not a player — separate namespaces,
 *    classified by GameStart membership (id ranges shift between games).
 *  - PlayerEvents are partial (only changed counters) — final counter = last
 *    value seen PER counter per player.
 *  - Don't hardcode team/player/base count or max HP — read from the file.
 */

export type IngestionFlag = { code: string; detail?: string };

export type RoundPlayer = {
  in_game_player_id: number;
  name: string;
  nickname: string;
  team: string; // colour
  headband_no: number | null;
};

export type RoundBase = { device_id: number; nickname: string };

export type DamageEvent = {
  time: string;
  actor_id: number;
  victim_id: number;
  damage: number;
  is_spawn_damage: boolean;
};
export type KillEvent = {
  time: string;
  actor_id: number;
  victim_id: number;
  is_spawn_kill: boolean;
};
export type RespawnEvent = { time: string; player_id: number };
export type CaptureEvent = {
  time: string;
  base_id: number;
  capturing_player_id: number | null; // null when ambiguous
  new_owner_team: string;
};

export type BaseOwnershipPeriod = {
  base_id: number;
  team: string;
  from_time: string;
  to_time: string | null;
  held_seconds: number;
};

export type PlayerCounters = {
  shots: number;
  hits: number;
  frags: number;
  deaths: number;
  wounds: number;
  revivals: number;
  treatments: number;
  captures: number;
  score: number;
};

export type Round = {
  meta: {
    start_time: string | null;
    duration_seconds: number | null;
    team_count: number;
    player_count: number;
    has_field_devices: boolean;
    max_hp: number;
  };
  scenario: { name: null; type: null; inferred_mode: "capture/domination" | "unknown" };
  teams: { colour: string; name: string }[];
  players: RoundPlayer[];
  bases: RoundBase[];
  events: {
    damage: DamageEvent[];
    kills: KillEvent[];
    respawns: RespawnEvent[];
    captures: CaptureEvent[];
  };
  base_ownership: BaseOwnershipPeriod[];
  final_player_counters: Record<number, PlayerCounters>;
  ingestion_flags: IngestionFlag[];
};

// --- helpers ---------------------------------------------------------------

type Raw = { EventTime?: string; ItemType?: string; Item?: Record<string, unknown> };

const SPAWN_WINDOW_SECONDS = 3; // config later
const LATE_MARGIN_SECONDS = 300; // events beyond round end + this are junk

/** "2026.08.01 02:30:05" -> epoch seconds (local). Returns NaN if unparseable. */
function toEpoch(t: string | undefined): number {
  if (!t) return NaN;
  const iso = t.replace(/\./g, "-").replace(" ", "T");
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? NaN : Math.floor(ms / 1000);
}

/** "00:10:50" -> 650 seconds. */
function durationToSeconds(d: string | undefined): number | null {
  if (!d) return null;
  const m = /^(\d+):(\d{2}):(\d{2})$/.exec(d.trim());
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

function headbandFromName(name: string | undefined): number | null {
  if (!name) return null;
  const m = /head\s*0*(\d+)/i.exec(name);
  return m ? Number(m[1]) : null;
}

const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);

// --- parser ----------------------------------------------------------------

export function parseRound(text: string): Round {
  const flags: IngestionFlag[] = [];

  // 1. JSONL -> objects. Skip blanks; tolerate a malformed final line.
  const lines = text.split(/\r?\n/);
  const raws: Raw[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      raws.push(JSON.parse(line) as Raw);
    } catch {
      if (i === lines.length - 1) {
        flags.push({ code: "malformed_final_line" });
      } else {
        flags.push({ code: "malformed_line", detail: `line ${i + 1}` });
      }
    }
  }

  // 2. GameStart -> meta, teams, players, bases.
  const start = raws.find((r) => r.ItemType === "GameStart");
  const startItem = (start?.Item ?? {}) as Record<string, unknown>;
  const teamsRaw = (startItem.Teams as { Name?: string; Colour?: string }[] | undefined) ?? [];
  const playersRaw = (startItem.Players as { PlayerId?: number; Name?: string; Nickname?: string; Team?: string }[] | undefined) ?? [];
  const devicesRaw = (startItem.FieldDevices as { FieldDeviceId?: number; Nickname?: string }[] | undefined) ?? [];

  const teams = teamsRaw.map((t) => ({ colour: t.Colour ?? "", name: t.Name ?? "" }));
  const players: RoundPlayer[] = playersRaw.map((p) => {
    const hb = headbandFromName(p.Name);
    if (hb === null) flags.push({ code: "no_headband", detail: `player ${p.PlayerId} name "${p.Name ?? ""}"` });
    return {
      in_game_player_id: p.PlayerId ?? -1,
      name: p.Name ?? "",
      nickname: p.Nickname ?? "",
      team: p.Team ?? "",
      headband_no: hb,
    };
  });
  const bases: RoundBase[] = devicesRaw.map((d) => ({ device_id: d.FieldDeviceId ?? -1, nickname: d.Nickname ?? "" }));

  // Classify ids by GameStart membership (ranges shift between games).
  const playerIds = new Set(players.map((p) => p.in_game_player_id));
  const baseIds = new Set(bases.map((b) => b.device_id));

  const startEpoch = toEpoch(startItem.StartTime as string | undefined);
  const durationSeconds = durationToSeconds(startItem.Duration as string | undefined);

  // Round end = the GameEnd (guard missing Item); else start + duration.
  const gameEnds = raws.filter((r) => r.ItemType === "GameEnd").map((r) => toEpoch(r.EventTime)).filter((e) => !Number.isNaN(e));
  const plausibleEnd =
    !Number.isNaN(startEpoch) && durationSeconds != null ? startEpoch + durationSeconds : NaN;
  // The real end is the earliest GameEnd within a plausible window; a ~3h-late
  // junk GameEnd is ignored.
  let roundEndEpoch = NaN;
  for (const ge of gameEnds.sort((a, b) => a - b)) {
    if (Number.isNaN(plausibleEnd) || ge <= plausibleEnd + LATE_MARGIN_SECONDS) {
      roundEndEpoch = ge;
      break;
    }
    flags.push({ code: "late_game_end", detail: `+${ge - plausibleEnd}s beyond plausible end` });
  }
  if (Number.isNaN(roundEndEpoch)) roundEndEpoch = plausibleEnd;

  const lateCutoff = Number.isNaN(roundEndEpoch) ? Infinity : roundEndEpoch + LATE_MARGIN_SECONDS;

  // 3-5. Bucket events; drop implausibly-late ones.
  type Ev = { time: string; epoch: number; item: Record<string, unknown> };
  const hitEv: Ev[] = [];
  const fragEv: Ev[] = [];
  const playerEv: Ev[] = [];
  const deviceEv: Ev[] = [];
  let lateDropped = 0;

  for (const r of raws) {
    if (!r.ItemType || r.ItemType === "GameStart" || r.ItemType === "GameEnd") continue;
    const epoch = toEpoch(r.EventTime);
    if (!Number.isNaN(epoch) && epoch > lateCutoff) {
      lateDropped++;
      continue;
    }
    const ev: Ev = { time: r.EventTime ?? "", epoch, item: (r.Item ?? {}) as Record<string, unknown> };
    switch (r.ItemType) {
      case "PlayerHitEvent": hitEv.push(ev); break;
      case "PlayerFragEvent": fragEv.push(ev); break;
      case "PlayerEvent": playerEv.push(ev); break;
      case "FieldDeviceEvent": deviceEv.push(ev); break;
      default: break; // TeamScoreChanged / LeaderTeamsChanged not needed here
    }
  }
  if (lateDropped > 0) flags.push({ code: "late_events_dropped", detail: String(lateDropped) });

  // max HP from data (health config); default 150 if none seen.
  let maxHp = 0;
  for (const ev of playerEv) {
    const hp = num(ev.item.HP);
    if (hp != null && hp > maxHp) maxHp = hp;
  }
  if (maxHp === 0) maxHp = 150;

  // 6. Damage.
  const damage: DamageEvent[] = hitEv.map((e) => ({
    time: e.time,
    actor_id: num(e.item.PlayerId) ?? -1,
    victim_id: num(e.item.VictimPlayerId) ?? -1,
    damage: num(e.item.Damage) ?? 0,
    is_spawn_damage: false,
  }));

  // 7. Kills.
  const kills: KillEvent[] = fragEv.map((e) => ({
    time: e.time,
    actor_id: num(e.item.PlayerId) ?? -1,
    victim_id: num(e.item.VictimPlayerId) ?? -1,
    is_spawn_kill: false,
  }));

  // Per-player time-sorted PlayerEvents (stable) for respawns, captures, counters.
  const byPlayer = new Map<number, Ev[]>();
  for (const ev of playerEv) {
    const pid = num(ev.item.PlayerId);
    if (pid == null || !playerIds.has(pid)) continue;
    if (!byPlayer.has(pid)) byPlayer.set(pid, []);
    byPlayer.get(pid)!.push(ev);
  }
  for (const arr of byPlayer.values()) arr.sort((a, b) => a.epoch - b.epoch);

  // 8. Respawns: Revivals increments to a NEW value AND HP == max. Dedup on
  // (player, Revivals). Not the initial spawn.
  const respawns: RespawnEvent[] = [];
  for (const [pid, evs] of byPlayer) {
    let prevRevivals = 0;
    const seenRevivals = new Set<number>();
    for (const ev of evs) {
      const rev = num(ev.item.Revivals);
      const hp = num(ev.item.HP);
      if (rev != null && rev > prevRevivals && hp === maxHp) {
        if (!seenRevivals.has(rev)) {
          seenRevivals.add(rev);
          respawns.push({ time: ev.time, player_id: pid });
        } else {
          flags.push({ code: "duplicate_respawn", detail: `player ${pid} revivals ${rev}` });
        }
        prevRevivals = rev;
      } else if (rev != null && rev > prevRevivals) {
        prevRevivals = rev; // counter moved but not a full-HP respawn frame
      }
    }
  }

  // 9. Captures: a PlayerEvent whose Captures counter increments, joined by the
  // same-second FieldDeviceEvent team flip. Ambiguity guard for same-second
  // multi-base flips.
  const deviceFlips: { epoch: number; base_id: number; team: string }[] = [];
  for (const ev of deviceEv) {
    const bid = num(ev.item.PlayerId);
    const team = ev.item.Team;
    if (bid != null && baseIds.has(bid) && typeof team === "string" && team) {
      deviceFlips.push({ epoch: ev.epoch, base_id: bid, team });
    }
  }
  const captures: CaptureEvent[] = [];
  for (const [pid, evs] of byPlayer) {
    let prevCaptures = 0;
    for (const ev of evs) {
      const cap = num(ev.item.Captures);
      if (cap != null && cap > prevCaptures) {
        prevCaptures = cap;
        const sameSecond = deviceFlips.filter((f) => f.epoch === ev.epoch);
        if (sameSecond.length === 1) {
          captures.push({ time: ev.time, base_id: sameSecond[0].base_id, capturing_player_id: pid, new_owner_team: sameSecond[0].team });
        } else if (sameSecond.length === 0) {
          captures.push({ time: ev.time, base_id: -1, capturing_player_id: pid, new_owner_team: "" });
          flags.push({ code: "capture_no_base_flip", detail: `player ${pid} at ${ev.time}` });
        } else {
          // multiple bases flipped this second — record but flag ambiguity
          for (const f of sameSecond) {
            captures.push({ time: ev.time, base_id: f.base_id, capturing_player_id: null, new_owner_team: f.team });
          }
          flags.push({ code: "capture_ambiguous_same_second", detail: `${ev.time} (${sameSecond.length} bases)` });
        }
      }
    }
  }

  // 10. Base ownership periods from device flips, per base sorted by time.
  const flipsByBase = new Map<number, { epoch: number; time: string; team: string }[]>();
  for (const ev of deviceEv) {
    const bid = num(ev.item.PlayerId);
    const team = ev.item.Team;
    if (bid == null || !baseIds.has(bid) || typeof team !== "string" || !team) continue;
    if (!flipsByBase.has(bid)) flipsByBase.set(bid, []);
    flipsByBase.get(bid)!.push({ epoch: ev.epoch, time: ev.time, team });
  }
  const base_ownership: BaseOwnershipPeriod[] = [];
  for (const [bid, flips] of flipsByBase) {
    flips.sort((a, b) => a.epoch - b.epoch);
    for (let i = 0; i < flips.length; i++) {
      const cur = flips[i];
      const next = flips[i + 1];
      const endEpoch = next ? next.epoch : roundEndEpoch;
      const held = Number.isNaN(endEpoch) ? 0 : Math.max(0, endEpoch - cur.epoch);
      base_ownership.push({
        base_id: bid,
        team: cur.team,
        from_time: cur.time,
        to_time: next ? next.time : null,
        held_seconds: held,
      });
    }
  }

  // 11. Final per-player counters = last value seen PER counter.
  const final_player_counters: Record<number, PlayerCounters> = {};
  for (const pid of playerIds) {
    final_player_counters[pid] = {
      shots: 0, hits: 0, frags: 0, deaths: 0, wounds: 0, revivals: 0, treatments: 0, captures: 0, score: 0,
    };
  }
  const counterKeys: [keyof PlayerCounters, string][] = [
    ["shots", "Shots"], ["hits", "Hits"], ["frags", "Frags"], ["deaths", "Deaths"],
    ["wounds", "Wounds"], ["revivals", "Revivals"], ["treatments", "Treatments"],
    ["captures", "Captures"], ["score", "Score"],
  ];
  for (const [pid, evs] of byPlayer) {
    const c = final_player_counters[pid];
    for (const ev of evs) {
      for (const [key, raw] of counterKeys) {
        const v = num(ev.item[raw]);
        if (v != null) c[key] = v;
      }
    }
  }

  // Cross-checks: Frags final vs counted; Captures final vs joined.
  for (const pid of playerIds) {
    const fragCount = kills.filter((k) => k.actor_id === pid).length;
    if (final_player_counters[pid].frags !== fragCount) {
      flags.push({ code: "frag_count_mismatch", detail: `player ${pid}: counter ${final_player_counters[pid].frags} vs ${fragCount} events` });
    }
    const capCount = captures.filter((c) => c.capturing_player_id === pid).length;
    if (final_player_counters[pid].captures !== capCount) {
      flags.push({ code: "capture_count_mismatch", detail: `player ${pid}: counter ${final_player_counters[pid].captures} vs ${capCount} joined` });
    }
  }

  // 12. Spawn flags: per event, victim-centric, vs the victim's most recent
  // MID-ROUND respawn. Initial spawn excluded (respawns list already is).
  const respawnsByPlayer = new Map<number, number[]>();
  for (const rs of respawns) {
    const e = toEpoch(rs.time);
    if (!respawnsByPlayer.has(rs.player_id)) respawnsByPlayer.set(rs.player_id, []);
    respawnsByPlayer.get(rs.player_id)!.push(e);
  }
  for (const arr of respawnsByPlayer.values()) arr.sort((a, b) => a - b);
  const mostRecentRespawn = (victim: number, epoch: number): number | null => {
    const arr = respawnsByPlayer.get(victim);
    if (!arr) return null;
    let best: number | null = null;
    for (const e of arr) {
      if (e <= epoch) best = e;
      else break;
    }
    return best;
  };
  let spawnDamage = 0;
  let spawnKills = 0;
  for (const d of damage) {
    const rs = mostRecentRespawn(d.victim_id, toEpoch(d.time));
    if (rs != null && toEpoch(d.time) - rs <= SPAWN_WINDOW_SECONDS) {
      d.is_spawn_damage = true;
      spawnDamage++;
    }
  }
  for (const k of kills) {
    const rs = mostRecentRespawn(k.victim_id, toEpoch(k.time));
    if (rs != null && toEpoch(k.time) - rs <= SPAWN_WINDOW_SECONDS) {
      k.is_spawn_kill = true;
      spawnKills++;
    }
  }
  if (spawnDamage > 0) flags.push({ code: "spawn_damage", detail: String(spawnDamage) });
  if (spawnKills > 0) flags.push({ code: "spawn_kills", detail: String(spawnKills) });

  return {
    meta: {
      start_time: (startItem.StartTime as string | undefined) ?? null,
      duration_seconds: durationSeconds,
      team_count: teams.length,
      player_count: players.length,
      has_field_devices: bases.length > 0,
      max_hp: maxHp,
    },
    scenario: { name: null, type: null, inferred_mode: bases.length > 0 ? "capture/domination" : "unknown" },
    teams,
    players,
    bases,
    events: { damage, kills, respawns, captures },
    base_ownership,
    final_player_counters,
    ingestion_flags: flags,
  };
}
