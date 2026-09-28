import { readFileSync } from "node:fs";
import { parseRound } from "../lib/ingestion/round-parser";
function ep(t: string) { const m = t.match(/(\d+)\.(\d+)\.(\d+) (\d+):(\d+):(\d+)/); if (!m) return NaN; return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000; }
const R = process.argv[2] || "3";
const TARGET = process.argv[3] || "Head 42";
const text = readFileSync(`sample-game-data/r${R}.json`, "utf8");
const r = parseRound(text, { spawnWindowSeconds: 3 });
const maxHp = r.meta.max_hp;
const pid = r.players.find((p) => p.name === TARGET)!.in_game_player_id;
const t0 = ep(r.meta.start_time!);
const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
type E = { t: number; hp?: number; deaths?: number; rev?: number; frags?: number };
const evs: E[] = [];
for (const l of lines) { let o: any; try { o = JSON.parse(l); } catch { continue; } if (o.ItemType !== "PlayerEvent") continue; const it = o.Item || {}; if (it.PlayerId !== pid) continue; evs.push({ t: ep(o.EventTime), hp: it.HP, deaths: it.Deaths, rev: it.Revivals, frags: it.Frags }); }
evs.sort((a, b) => a.t - b.t);
// deaths this player suffered (as victim) and their times
const diedAt = r.events.kills.filter((k) => k.victim_id === pid).map((k) => ep(k.time)).sort((a, b) => a - b);
console.log(`R${R} ${TARGET} pid=${pid} maxHp=${maxHp} deaths=${r.final_player_counters[pid].deaths} victimKills=${diedAt.length}`);
console.log("Deaths-as-victim (rel s):", diedAt.map((d) => d - t0).join(", "));
console.log("PlayerEvent stream [rel_s: HP/Deaths/Rev]:");
let out = "";
for (const e of evs) { const rel = e.t - t0; const parts: string[] = []; if (e.hp != null) parts.push("HP" + e.hp); if (e.deaths != null) parts.push("D" + e.deaths); if (e.rev != null) parts.push("R" + e.rev); out += `${rel}:${parts.join("/")}  `; }
console.log(out);
