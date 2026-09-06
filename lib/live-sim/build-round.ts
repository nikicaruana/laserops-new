/**
 * lib/live-sim/build-round.ts
 * --------------------------------------------------------------------
 * Build the compact RoundData timeline the live views render, from a round's raw
 * JSON — tolerant of a PARTIAL (still-being-written) file, so the producer can
 * push a fresh snapshot every couple of seconds during play. Names + guns are
 * resolved by the caller (headband -> profile name + booked gun). Mirrors
 * scripts/build-sim-data.ts but parameterised and partial-safe.
 */
import { parseRound } from "@/lib/ingestion/round-parser";
import type { RoundData } from "@/lib/live-sim/engine";

const ep = (t: string) => { const m = t.match(/(\d+)\.(\d+)\.(\d+) (\d+):(\d+):(\d+)/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000 : NaN; };

function computeBurns(ownership: { base_id: number; team: string; from_time: string; held_seconds: number }[], start: number, threshold: number) {
  const byBase = new Map<number, typeof ownership>();
  for (const p of ownership) { if (!byBase.has(p.base_id)) byBase.set(p.base_id, []); byBase.get(p.base_id)!.push(p); }
  const burns: { baseId: number; team: string; t: number }[] = [];
  for (const [bid, periods] of byBase) {
    const sorted = [...periods].sort((a, b) => ep(a.from_time) - ep(b.from_time));
    const cum: Record<string, number> = {};
    for (const p of sorted) {
      const before = cum[p.team] ?? 0;
      if (before + p.held_seconds >= threshold) { burns.push({ baseId: bid, team: p.team, t: Math.max(0, Math.round(ep(p.from_time) - start + (threshold - before))) }); break; }
      cum[p.team] = before + p.held_seconds;
    }
  }
  return burns.sort((a, b) => a.t - b.t);
}

export type RoundResolvers = {
  /** headband label ("Head 39") -> display name (profile ops tag, else the label). */
  nameOf: (headband: string) => string;
  /** headband label -> booked gun { name, image } (image may be ""). */
  gunOf: (headband: string) => { name: string; image: string };
};

const ORDER = ["Wall", "Middle", "Trees"];

/** Build one round's live timeline. `roundNo` numbers it within the match.
 *  Returns the RoundData + the round's start epoch (seconds), or null if
 *  there's nothing usable yet (no start / players). */
export function buildLiveRound(raw: string, roundNo: number, res: RoundResolvers): { round: RoundData; startEpoch: number } | null {
  let r;
  try { r = parseRound(raw, { spawnWindowSeconds: 3 }); } catch { return null; }
  if (!r.players.length || !r.meta.start_time) return null;
  const start = ep(r.meta.start_time);
  if (!Number.isFinite(start)) return null;

  const name: Record<number, string> = {};
  for (const p of r.players) name[p.in_game_player_id] = res.nameOf(p.name);
  const baseName: Record<number, string> = {};
  for (const b of r.bases) baseName[b.device_id] = b.nickname || `Base ${b.device_id}`;

  const events: RoundData["events"] = [];
  for (const k of r.events.kills) events.push({ t: Math.max(0, ep(k.time) - start), type: "kill", actor: name[k.actor_id], victim: name[k.victim_id], spawn: k.is_spawn_kill });
  for (const c of r.events.captures) { if (c.capturing_player_id == null || c.base_id < 0) continue; events.push({ t: Math.max(0, ep(c.time) - start), type: "capture", pid: name[c.capturing_player_id], base: baseName[c.base_id], team: c.new_owner_team }); }
  for (const rs of r.events.respawns) events.push({ t: Math.max(0, ep(rs.time) - start), type: "respawn", pid: name[rs.player_id] });
  events.sort((a, b) => a.t - b.t);

  const baseFlips = r.base_ownership.map((p) => ({ t: Math.max(0, ep(p.from_time) - start), baseId: p.base_id, team: p.team })).sort((a, b) => a.t - b.t);

  const nameCounts: Record<string, number> = {};
  for (const b of r.bases) nameCounts[baseName[b.device_id]] = (nameCounts[baseName[b.device_id]] ?? 0) + 1;
  const bases = r.bases
    .map((b) => ({ id: b.device_id, name: nameCounts[baseName[b.device_id]] > 1 ? `${baseName[b.device_id]} #${b.device_id}` : baseName[b.device_id] }))
    .sort((a, b) => { const ia = ORDER.indexOf(a.name), ib = ORDER.indexOf(b.name); if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib); return a.id - b.id; });

  const round: RoundData = {
    round: roundNo,
    winner: r.result.winner_team,
    durationSeconds: r.meta.duration_seconds ?? Math.ceil(Math.max(0, ...events.map((e) => e.t)) + 5),
    teams: r.teams.map((t) => t.colour),
    players: r.players.map((p) => { const g = res.gunOf(p.name); return { name: name[p.in_game_player_id], team: p.team, gunName: g.name, gunImage: g.image }; }),
    bases,
    baseFlips,
    burns: computeBurns(r.base_ownership, start, r.result.burn_threshold_seconds),
    burnThresholdSeconds: r.result.burn_threshold_seconds,
    events,
  };
  return { round, startEpoch: start };
}
