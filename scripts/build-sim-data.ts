/**
 * scripts/build-sim-data.ts
 * Build a COMPACT multi-round match timeline for the live-view simulation:
 * per round — kills, captures, respawns, base ownership flips, burns, per-player
 * guns. Output: lib/live-sim/match.json ({ label, rounds: [...] }).
 *   npx tsx scripts/build-sim-data.ts sample-game-data "LO-2026-27"
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { parseRound } from "../lib/ingestion/round-parser";

const DIR = process.argv[2] || "sample-game-data";
const LABEL = process.argv[3] || "LO-2026-27";
const NAMES: Record<string, string> = {
  "Head 01": "Snaaaaaaake", "Head 06": "Jens", "Head 40": "TheHolySpirit", "Head 42": "Tompa", "Head 45": "aximus",
  "Head 02": "Buwdha", "Head 04": "Sina", "Head 37": "BSoD", "Head 39": "Jinnies", "Head 41": "Glenn",
};
const WEAPON: Record<string, string> = {
  "Head 39": "Predator", "Head 02": "Predator", "Head 41": "Phoenix", "Head 37": "Predator", "Head 04": "Phoenix",
  "Head 06": "Predator", "Head 01": "Phoenix", "Head 40": "Predator", "Head 42": "Predator", "Head 45": "Ranger",
};
const ep = (t: string) => { const m = t.match(/(\d+)\.(\d+)\.(\d+) (\d+):(\d+):(\d+)/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000 : NaN; };
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

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

function buildRound(file: string, roundNo: number, gunImage: (w: string) => { name: string; image: string }) {
  const r = parseRound(readFileSync(file, "utf8"), { spawnWindowSeconds: 3 });
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

  const flips = r.base_ownership.map((p) => ({ t: Math.max(0, ep(p.from_time) - start), baseId: p.base_id, team: p.team })).sort((a, b) => a.t - b.t);

  const damageEvents = r.events.damage
    .filter((d) => d.damage > 0 && name[d.actor_id])
    .map((d) => ({ t: Math.max(0, ep(d.time) - start), actor: name[d.actor_id], amount: d.damage }))
    .sort((a, b) => a.t - b.t);
  const capByBaseTime = new Map();
  for (const c of r.events.captures) if (c.capturing_player_id != null && c.base_id >= 0) capByBaseTime.set(`${c.base_id}|${c.time}`, c.capturing_player_id);
  const holdPeriods = r.base_ownership
    .map((per) => {
      const pid = capByBaseTime.get(`${per.base_id}|${per.from_time}`);
      if (pid == null || !name[pid]) return null;
      const from = Math.max(0, ep(per.from_time) - start);
      const to = per.to_time ? Math.max(from, ep(per.to_time) - start) : 1e9;
      return { pid: name[pid], from, to };
    })
    .filter((x) => x !== null);
  // Bases keyed by device ID (default names can repeat across bases — disambiguate).
  const nameCounts: Record<string, number> = {};
  for (const b of r.bases) nameCounts[baseName[b.device_id]] = (nameCounts[baseName[b.device_id]] ?? 0) + 1;
  const order = ["Wall", "Middle", "Trees"];
  const bases = r.bases
    .map((b) => ({ id: b.device_id, name: nameCounts[baseName[b.device_id]] > 1 ? `${baseName[b.device_id]} #${b.device_id}` : baseName[b.device_id] }))
    .sort((a, b) => { const ia = order.indexOf(a.name), ib = order.indexOf(b.name); if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib); return a.id - b.id; });

  return {
    round: roundNo,
    winner: r.result.winner_team,
    durationSeconds: r.meta.duration_seconds ?? Math.ceil(Math.max(...events.map((e) => e.t)) + 5),
    teams: r.teams.map((t) => t.colour),
    players: r.players.map((p) => { const g = gunImage(WEAPON[p.name] ?? ""); return { name: name[p.in_game_player_id], team: p.team, gunName: g.name, gunImage: g.image }; }),
    bases,
    baseFlips: flips,
    burns: computeBurns(r.base_ownership, start, r.result.burn_threshold_seconds),
    burnThresholdSeconds: r.result.burn_threshold_seconds,
    events,
    damageEvents,
    holdPeriods,
  };
}

async function main() {
  const env = readFileSync(".env.local", "utf8");
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)![1].trim();
  const anon = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)![1].trim();
  const guns = (await (await fetch(`${url}/rest/v1/guns?select=name,image_url&limit=50`, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } })).json()) as { name: string; image_url: string | null }[];
  const gunImage = (weapon: string) => { const g = guns.find((x) => norm(x.name).includes(norm(weapon))); return { name: g?.name ?? weapon, image: g?.image_url ?? "" }; };

  const files = readdirSync(DIR).filter((f) => /^r\d+\.json$/i.test(f)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
  const rounds = files.map((f, i) => buildRound(`${DIR}/${f}`, i + 1, gunImage));
  mkdirSync("lib/live-sim", { recursive: true });
  writeFileSync("lib/live-sim/match.json", JSON.stringify({ label: LABEL, rounds }));
  console.log(`Wrote lib/live-sim/match.json — ${rounds.length} rounds: ${rounds.map((r) => `R${r.round}(${r.winner},${r.bases.join("/")})`).join(", ")}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
