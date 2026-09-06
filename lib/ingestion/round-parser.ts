/**
 * lib/ingestion/round-parser.ts
 * --------------------------------------------------------------------
 * Layer A of the LaserOps round ingestion: turn ONE LaserWar/Alphatag online
 * game JSON file (one round, JSONL) into clean, structured per-player / per-base
 * facts. Pure fact-extraction – NO ELO / XP / score / streak logic (those
 * consume this output). Built to the ground-truth spec:
 *   docs/ingestion/LaserOps_JSON_Parsing_Pack_2.md
 *
 * Defensive by design (per the spec's hard-won rules):
 *  - JSONL, one object per line; tolerate blanks + a malformed final line.
 *  - GameEnd may have no `Item` – guard everywhere.
 *  - File is NOT globally time-sorted (devices buffer offline) – all timing
 *    logic sorts per player/base by EventTime first; never trust line order.
 *  - Whole-second timestamps.
 *  - FieldDeviceEvent.PlayerId is a BASE id, not a player – separate namespaces,
 *    classified by GameStart membership (id ranges shift between games).
 *  - PlayerEvents are partial (only changed counters) – final counter = last
 *    value seen PER counter per player.
 *  - Don't hardcode team/player/base count or max HP – read from the file.
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
  /** The killer's HP at the moment of the kill (for the Survivor streak). */
  actor_hp: number | null;
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

/**
 * A base burn: in domination a base burns (permanently captured) when ONE team's
 * CUMULATIVE hold time on it reaches the burn threshold. That team is the burner.
 */
/**
 * A same-second capture ambiguity: 2+ players on the SAME team captured 2+
 * distinct bases in the SAME second, so which player captured which base (and
 * therefore which base's hold time each is credited with) cannot be proven from
 * the JSON. Surfaced for mandatory admin review before final scoring.
 */
export type AmbiguousCaptureGroup = {
  id: string; // stable key `${time}|${team}`
  time: string;
  team: string;
  base_ids: number[];
  player_ids: number[];
  /** Hold seconds of each base in the group (what's at stake in the pairing). */
  holds: { base_id: number; held_seconds: number }[];
};

export type BaseBurn = {
  base_id: number;
  team: string;
  /** Device-clock epoch (seconds) when cumulative hold crossed the threshold. */
  burn_epoch: number;
  cumulative_seconds: number;
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
  /**
   * Domination outcome. A base burns when a team's cumulative hold reaches
   * `burn_threshold_seconds`; the round is WON by the team that burns a majority
   * of bases (>= ceil(bases/2)). The game's own points/IsWinner are NOT used.
   */
  result: {
    burn_threshold_seconds: number;
    burns: BaseBurn[];
    winner_team: string | null;
    all_bases_burned: boolean;
  };
  /** Same-second same-team capture ambiguities needing admin review. */
  ambiguous_captures: AmbiguousCaptureGroup[];
  final_player_counters: Record<number, PlayerCounters>;
  /** Real damage dealt per player = Σ actual PlayerHitEvent.Damage (the game
   *  already reports applied damage, so this caps overkill – unlike hits×gun). */
  damage_dealt: Record<number, number>;
  /** Capture/hold time per player = Σ seconds the bases they captured were held. */
  hold_seconds: Record<number, number>;
  /** Who's spawn camping (the shooter): spawn_kills_by = count of spawn kills;
   *  spawn_damage_by = total DAMAGE dealt in spawn-flagged hits (the voidable amount). */
  spawn_kills_by: Record<number, number>;
  spawn_damage_by: Record<number, number>;
  ingestion_flags: IngestionFlag[];
};

// --- helpers ---------------------------------------------------------------

type Raw = { EventTime?: string; ItemType?: string; Item?: Record<string, unknown> };

const SPAWN_WINDOW_SECONDS = 3; // config later
const LATE_MARGIN_SECONDS = 300; // events beyond round end + this are junk
const DEFAULT_BURN_THRESHOLD_SECONDS = 600; // 10 min cumulative hold burns a base

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

export function parseRound(
  text: string,
  opts?: { burnThresholdSeconds?: number; spawnWindowSeconds?: number },
): Round {
  const flags: IngestionFlag[] = [];
  const burnThreshold = opts?.burnThresholdSeconds ?? DEFAULT_BURN_THRESHOLD_SECONDS;
  // Spawn-protection window from Exploit Control (spawn_camp_config.protection_window_seconds).
  const spawnWindow = opts?.spawnWindowSeconds ?? SPAWN_WINDOW_SECONDS;

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
  // Bases (field devices) IN PLAY = the device ids that actually appear in
  // FieldDeviceEvents (ground truth). GameStart.FieldDevices supplies names, but
  // its ids can mismatch the event ids (seen in a real R5 file: registered id 102
  // but events use id 3), so we key on events and back-fill names by id, with a
  // position-based fallback for a single unmatched device.
  const gsNameById = new Map<number, string>();
  for (const d of devicesRaw) if (d.FieldDeviceId != null) gsNameById.set(d.FieldDeviceId, d.Nickname ?? "");
  const eventDeviceIds = new Set<number>();
  for (const r of raws) {
    if (r.ItemType !== "FieldDeviceEvent") continue;
    const bid = num((r.Item as Record<string, unknown> | undefined)?.PlayerId);
    if (bid != null) eventDeviceIds.add(bid);
  }
  const sortedDeviceIds = [...eventDeviceIds].sort((a, b) => a - b);
  const unmatchedEventIds = sortedDeviceIds.filter((id) => !gsNameById.has(id));
  const unmatchedGs = [...gsNameById.entries()].filter(([id]) => !eventDeviceIds.has(id)).sort((a, b) => a[0] - b[0]);
  const remap = new Map<number, string>();
  if (unmatchedEventIds.length > 0 && unmatchedEventIds.length === unmatchedGs.length) {
    unmatchedEventIds.forEach((id, i) => remap.set(id, unmatchedGs[i][1]));
    flags.push({ code: "device_id_remapped", detail: `${unmatchedEventIds.length} base(s) named by position (GameStart ids differ from event ids)` });
  }
  const bases: RoundBase[] = sortedDeviceIds.map((id) => ({ device_id: id, nickname: gsNameById.get(id) ?? remap.get(id) ?? "" }));

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
    actor_hp: null,
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

  // Killer HP at each kill (last known HP at/before the kill time) – for Survivor.
  const hpAt = (pid: number, epoch: number): number | null => {
    const evs = byPlayer.get(pid);
    if (!evs) return null;
    let hp: number | null = null;
    for (const ev of evs) {
      if (ev.epoch <= epoch) {
        const h = num(ev.item.HP);
        if (h != null) hp = h;
      } else break;
    }
    return hp;
  };
  for (const k of kills) k.actor_hp = hpAt(k.actor_id, toEpoch(k.time));

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

  // 9. Captures: attribute each player's Captures-counter increment to a base
  // that flipped in the SAME second. A player can only have captured a base that
  // flipped to THEIR team, so multi-base same-second flips are matched by team.
  // If several same-team bases flip together, pair them 1:1 (each capturer gets a
  // distinct base) and flag the exact base as inferred — the count + distinct-set
  // stay correct even when the precise base can't be proven.
  const teamOfPlayer = new Map<number, string>();
  for (const p of players) teamOfPlayer.set(p.in_game_player_id, p.team);

  // Device flips grouped by second (mutable `taken` marks consumed matches).
  const flipsBySecond = new Map<number, { base_id: number; team: string; taken: boolean }[]>();
  for (const ev of deviceEv) {
    const bid = num(ev.item.PlayerId);
    const team = ev.item.Team;
    if (bid == null || !baseIds.has(bid) || typeof team !== "string" || !team) continue;
    if (!flipsBySecond.has(ev.epoch)) flipsBySecond.set(ev.epoch, []);
    flipsBySecond.get(ev.epoch)!.push({ base_id: bid, team, taken: false });
  }

  // Each player's Captures-counter increments, in time order (delta per event).
  const capIncrements: { epoch: number; time: string; pid: number; team: string; delta: number }[] = [];
  for (const [pid, evs] of byPlayer) {
    let prev = 0;
    for (const ev of evs) {
      const cap = num(ev.item.Captures);
      if (cap != null && cap > prev) {
        capIncrements.push({ epoch: ev.epoch, time: ev.time, pid, team: teamOfPlayer.get(pid) ?? "", delta: cap - prev });
        prev = cap;
      }
    }
  }
  capIncrements.sort((a, b) => a.epoch - b.epoch);

  const captures: CaptureEvent[] = [];
  for (const inc of capIncrements) {
    const flips = flipsBySecond.get(inc.epoch) ?? [];
    const sameTeamThisSecond = flips.filter((f) => f.team === inc.team).length;
    for (let n = 0; n < inc.delta; n++) {
      // Prefer an untaken flip whose new owner is the capturer's team; else any
      // untaken flip this second (last resort).
      let flip = flips.find((f) => !f.taken && f.team === inc.team) ?? flips.find((f) => !f.taken);
      if (flip) {
        flip.taken = true;
        captures.push({ time: inc.time, base_id: flip.base_id, capturing_player_id: inc.pid, new_owner_team: flip.team });
        if (sameTeamThisSecond > 1) flags.push({ code: "capture_base_inferred", detail: `player ${inc.pid} at ${inc.time}` });
      } else {
        captures.push({ time: inc.time, base_id: -1, capturing_player_id: inc.pid, new_owner_team: "" });
        flags.push({ code: "capture_no_base_flip", detail: `player ${inc.pid} at ${inc.time}` });
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

  // 10a2. Ambiguous same-second captures: 2+ players on the SAME team capturing
  // 2+ distinct bases in the SAME second. The base<->player pairing is arbitrary
  // (the JSON can't prove it), so which base's hold each player gets is unproven.
  // Surfaced for mandatory admin review before final scoring.
  const ambiguous_captures: AmbiguousCaptureGroup[] = [];
  {
    const capGroups = new Map<string, CaptureEvent[]>();
    for (const c of captures) {
      if (c.capturing_player_id == null || c.base_id < 0) continue;
      const key = `${c.time}|${c.new_owner_team}`;
      if (!capGroups.has(key)) capGroups.set(key, []);
      capGroups.get(key)!.push(c);
    }
    for (const [key, g] of capGroups) {
      const bIds = [...new Set(g.map((c) => c.base_id))];
      const pIds = [...new Set(g.map((c) => c.capturing_player_id as number))];
      if (bIds.length >= 2 && pIds.length >= 2) {
        const holds = bIds.map((b) => {
          const cap = g.find((c) => c.base_id === b)!;
          const per = base_ownership.find((p) => p.base_id === b && p.from_time === cap.time);
          return { base_id: b, held_seconds: per?.held_seconds ?? 0 };
        });
        ambiguous_captures.push({ id: key, time: g[0].time, team: g[0].new_owner_team, base_ids: bIds, player_ids: pIds, holds });
      }
    }
  }

  // 10b. Burns + round winner. A base burns when ONE team's CUMULATIVE hold
  // (summed across all its possessions) reaches the threshold; that team is the
  // burner and the base then locks. The round is won by the team burning a
  // majority of bases. The game's own points/IsWinner are deliberately ignored.
  const burns: BaseBurn[] = [];
  for (const [bid, flips] of flipsByBase) {
    const sorted = flips.slice().sort((a, b) => a.epoch - b.epoch);
    const cumByTeam: Record<string, number> = {};
    for (let i = 0; i < sorted.length; i++) {
      const cur = sorted[i];
      const next = sorted[i + 1];
      const endEpoch = next ? next.epoch : roundEndEpoch;
      if (Number.isNaN(endEpoch)) break;
      const periodLen = Math.max(0, endEpoch - cur.epoch);
      const before = cumByTeam[cur.team] ?? 0;
      if (before + periodLen >= burnThreshold) {
        burns.push({ base_id: bid, team: cur.team, burn_epoch: cur.epoch + (burnThreshold - before), cumulative_seconds: burnThreshold });
        cumByTeam[cur.team] = burnThreshold;
        break; // base locks on burn
      }
      cumByTeam[cur.team] = before + periodLen;
    }
  }
  const burnCounts: Record<string, number> = {};
  for (const b of burns) burnCounts[b.team] = (burnCounts[b.team] ?? 0) + 1;
  const majority = Math.floor(bases.length / 2) + 1;
  let winner_team: string | null = null;
  for (const [team, n] of Object.entries(burnCounts)) if (n >= majority) winner_team = team;
  const all_bases_burned = bases.length > 0 && burns.length === bases.length;
  if (bases.length > 0 && winner_team === null) {
    flags.push({ code: "no_burn_winner", detail: `burns: ${JSON.stringify(burnCounts)} of ${bases.length} bases` });
  }
  const result = { burn_threshold_seconds: burnThreshold, burns, winner_team, all_bases_burned };

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

  // Derived: real damage dealt per player (JSON-accurate, already applied/capped).
  const damage_dealt: Record<number, number> = {};
  const hold_seconds: Record<number, number> = {};
  for (const pid of playerIds) {
    damage_dealt[pid] = 0;
    hold_seconds[pid] = 0;
  }
  for (const d of damage) {
    if (damage_dealt[d.actor_id] != null) damage_dealt[d.actor_id] += d.damage;
  }
  // Capture/hold time: attribute each ownership period's seconds to the player
  // who captured it (matched by base + capture timestamp).
  for (const period of base_ownership) {
    const cap = captures.find(
      (c) => c.base_id === period.base_id && c.time === period.from_time && c.capturing_player_id != null,
    );
    if (cap?.capturing_player_id != null && hold_seconds[cap.capturing_player_id] != null) {
      hold_seconds[cap.capturing_player_id] += period.held_seconds;
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
  const spawn_kills_by: Record<number, number> = {};
  const spawn_damage_by: Record<number, number> = {};
  for (const pid of playerIds) {
    spawn_kills_by[pid] = 0;
    spawn_damage_by[pid] = 0;
  }
  let spawnDamage = 0;
  let spawnKills = 0;
  for (const d of damage) {
    // A hit that applied 0 HP (target invulnerable – post-hit i-frames, spawn or
    // game-start protection, a shield) is a registered tag but not real damage,
    // so it can never be spawn trapping. Only damaging hits count.
    if (d.damage <= 0) continue;
    const rs = mostRecentRespawn(d.victim_id, toEpoch(d.time));
    if (rs != null && toEpoch(d.time) - rs <= spawnWindow) {
      d.is_spawn_damage = true;
      spawnDamage++;
      if (spawn_damage_by[d.actor_id] != null) spawn_damage_by[d.actor_id] += d.damage;
    }
  }
  for (const k of kills) {
    const rs = mostRecentRespawn(k.victim_id, toEpoch(k.time));
    if (rs != null && toEpoch(k.time) - rs <= spawnWindow) {
      k.is_spawn_kill = true;
      spawnKills++;
      if (spawn_kills_by[k.actor_id] != null) spawn_kills_by[k.actor_id]++;
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
    result,
    ambiguous_captures,
    final_player_counters,
    damage_dealt,
    hold_seconds,
    spawn_kills_by,
    spawn_damage_by,
    ingestion_flags: flags,
  };
}
