/**
 * scripts/build-sim-data.ts
 * Extract a COMPACT match timeline from a round JSON for the live-view
 * simulation (replay by timestamp). Output: lib/live-sim/round.json.
 *   npx tsx scripts/build-sim-data.ts sample-game-data/r3.json LO-2026-27-R3
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { parseRound } from "../lib/ingestion/round-parser";

const FILE = process.argv[2] || "sample-game-data/r3.json";
const LABEL = process.argv[3] || "Simulated match";
const NAMES: Record<string, string> = {
  "Head 01": "Snaaaaaaake", "Head 06": "Jens", "Head 40": "TheHolySpirit", "Head 42": "Tompa", "Head 45": "aximus",
  "Head 02": "Buwdha", "Head 04": "Sina", "Head 37": "BSoD", "Head 39": "Jinnies", "Head 41": "Glenn",
};
const ep = (t: string) => { const m = t.match(/(\d+)\.(\d+)\.(\d+) (\d+):(\d+):(\d+)/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000 : NaN; };

const r = parseRound(readFileSync(FILE, "utf8"), { spawnWindowSeconds: 3 });
const start = ep(r.meta.start_time!);
const name: Record<number, string> = {};
for (const p of r.players) name[p.in_game_player_id] = NAMES[p.name] ?? p.name;
const baseName: Record<number, string> = {};
for (const b of r.bases) baseName[b.device_id] = b.nickname || `Base ${b.device_id}`;

type Ev = { t: number; type: "kill" | "capture" | "respawn"; actor?: string; victim?: string; spawn?: boolean; pid?: string; base?: string; team?: string };
const events: Ev[] = [];
for (const k of r.events.kills) events.push({ t: Math.max(0, ep(k.time) - start), type: "kill", actor: name[k.actor_id], victim: name[k.victim_id], spawn: k.is_spawn_kill });
for (const c of r.events.captures) { if (c.capturing_player_id == null) continue; events.push({ t: Math.max(0, ep(c.time) - start), type: "capture", pid: name[c.capturing_player_id], base: baseName[c.base_id] ?? "Base", team: c.new_owner_team }); }
for (const rs of r.events.respawns) events.push({ t: Math.max(0, ep(rs.time) - start), type: "respawn", pid: name[rs.player_id] });
events.sort((a, b) => a.t - b.t);

const out = {
  label: LABEL,
  durationSeconds: r.meta.duration_seconds ?? Math.ceil(Math.max(...events.map((e) => e.t)) + 5),
  players: r.players.map((p) => ({ name: name[p.in_game_player_id], team: p.team })),
  events,
};
mkdirSync("lib/live-sim", { recursive: true });
writeFileSync("lib/live-sim/round.json", JSON.stringify(out));
console.log(`Wrote lib/live-sim/round.json — ${out.players.length} players, ${events.length} events, ${out.durationSeconds}s`);
