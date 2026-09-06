/**
 * scripts/build-sim-data.ts
 * Extract a COMPACT match timeline (kills, captures, respawns, base ownership
 * flips, per-player guns) from a round JSON for the live-view simulation.
 *   npx tsx scripts/build-sim-data.ts sample-game-data/r1.json "LO-2026-27 · Round 1"
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { parseRound } from "../lib/ingestion/round-parser";

const FILE = process.argv[2] || "sample-game-data/r1.json";
const LABEL = process.argv[3] || "LO-2026-27 · Round 1";
const NAMES: Record<string, string> = {
  "Head 01": "Snaaaaaaake", "Head 06": "Jens", "Head 40": "TheHolySpirit", "Head 42": "Tompa", "Head 45": "aximus",
  "Head 02": "Buwdha", "Head 04": "Sina", "Head 37": "BSoD", "Head 39": "Jinnies", "Head 41": "Glenn",
};
// Per-player weapon (from the R2 .lwa; representative for the sim).
const WEAPON: Record<string, string> = {
  "Head 39": "Predator", "Head 02": "Predator", "Head 41": "Phoenix", "Head 37": "Predator", "Head 04": "Phoenix",
  "Head 06": "Predator", "Head 01": "Phoenix", "Head 40": "Predator", "Head 42": "Predator", "Head 45": "Ranger",
};
const ep = (t: string) => { const m = t.match(/(\d+)\.(\d+)\.(\d+) (\d+):(\d+):(\d+)/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000 : NaN; };
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Recompute burn times on the SIM clock (from hold durations, which are
 *  clock-agnostic) — the parser's burn_epoch is on the drifted device clock. */
function computeBurns(ownership: { base_id: number; team: string; from_time: string; held_seconds: number }[], baseName: Record<number, string>, start: number, threshold: number) {
  const byBase = new Map<number, typeof ownership>();
  for (const p of ownership) { if (!byBase.has(p.base_id)) byBase.set(p.base_id, []); byBase.get(p.base_id)!.push(p); }
  const burns: { base: string; team: string; t: number }[] = [];
  for (const [bid, periods] of byBase) {
    const sorted = [...periods].sort((a, b) => ep(a.from_time) - ep(b.from_time));
    const cum: Record<string, number> = {};
    for (const p of sorted) {
      const before = cum[p.team] ?? 0;
      if (before + p.held_seconds >= threshold) {
        burns.push({ base: baseName[bid], team: p.team, t: Math.max(0, Math.round(ep(p.from_time) - start + (threshold - before))) });
        break;
      }
      cum[p.team] = before + p.held_seconds;
    }
  }
  return burns.sort((a, b) => a.t - b.t);
}

async function main() {
  // Gun images from the DB (anon, public-read).
  const env = readFileSync(".env.local", "utf8");
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)![1].trim();
  const anon = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)![1].trim();
  const guns = (await (await fetch(`${url}/rest/v1/guns?select=name,image_url&limit=50`, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } })).json()) as { name: string; image_url: string | null }[];
  const gunImage = (weapon: string) => { const g = guns.find((x) => norm(x.name).includes(norm(weapon))); return { name: g?.name ?? weapon, image: g?.image_url ?? "" }; };

  const r = parseRound(readFileSync(FILE, "utf8"), { spawnWindowSeconds: 3 });
  const start = ep(r.meta.start_time!);
  const name: Record<number, string> = {};
  for (const p of r.players) name[p.in_game_player_id] = NAMES[p.name] ?? p.name;
  const baseName: Record<number, string> = {};
  for (const b of r.bases) baseName[b.device_id] = b.nickname || `Base ${b.device_id}`;

  type Ev = { t: number; type: "kill" | "capture" | "respawn"; actor?: string; victim?: string; spawn?: boolean; pid?: string; base?: string; team?: string };
  const events: Ev[] = [];
  for (const k of r.events.kills) events.push({ t: Math.max(0, ep(k.time) - start), type: "kill", actor: name[k.actor_id], victim: name[k.victim_id], spawn: k.is_spawn_kill });
  for (const c of r.events.captures) { if (c.capturing_player_id == null || c.base_id < 0) continue; events.push({ t: Math.max(0, ep(c.time) - start), type: "capture", pid: name[c.capturing_player_id], base: baseName[c.base_id], team: c.new_owner_team }); }
  for (const rs of r.events.respawns) events.push({ t: Math.max(0, ep(rs.time) - start), type: "respawn", pid: name[rs.player_id] });
  events.sort((a, b) => a.t - b.t);

  // Base ownership flips (each ownership period start = a flip to that team).
  const flips = r.base_ownership
    .map((p) => ({ t: Math.max(0, ep(p.from_time) - start), base: baseName[p.base_id], team: p.team }))
    .sort((a, b) => a.t - b.t);

  // Base display order: Wall, Middle, Trees (fallback: natural).
  const order = ["Wall", "Middle", "Trees"];
  const baseNames = [...new Set(r.bases.map((b) => baseName[b.device_id]))].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const out = {
    label: LABEL,
    durationSeconds: r.meta.duration_seconds ?? Math.ceil(Math.max(...events.map((e) => e.t)) + 5),
    teams: r.teams.map((t) => t.colour),
    players: r.players.map((p) => { const g = gunImage(WEAPON[p.name] ?? ""); return { name: name[p.in_game_player_id], team: p.team, gunName: g.name, gunImage: g.image }; }),
    bases: baseNames,
    baseFlips: flips,
    burns: computeBurns(r.base_ownership, baseName, start, r.result.burn_threshold_seconds),
    burnThresholdSeconds: r.result.burn_threshold_seconds,
    events,
  };
  mkdirSync("lib/live-sim", { recursive: true });
  writeFileSync("lib/live-sim/round.json", JSON.stringify(out));
  console.log(`Wrote lib/live-sim/round.json — ${out.players.length} players, ${events.length} events, ${flips.length} base flips, bases: ${baseNames.join(", ")}, ${out.durationSeconds}s`);
}
main().catch((e) => { console.error(e); process.exit(1); });
