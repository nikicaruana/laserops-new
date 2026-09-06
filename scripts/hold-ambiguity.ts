import { readFileSync, readdirSync } from "node:fs";
import { parseRound } from "../lib/ingestion/round-parser";
const DIR = process.argv[2] || "sample-game-data";
const files = readdirSync(DIR).filter((f) => /^r\d+\.json$/i.test(f)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

let totalCaps = 0, sameSecondMultiTeam = 0, ambiguousGroups = 0, ambiguousCaps = 0, maxDisparity = 0;
for (const f of files) {
  const r = parseRound(readFileSync(`${DIR}/${f}`, "utf8"), { spawnWindowSeconds: 3 });
  const name: Record<number, string> = {}; for (const p of r.players) name[p.in_game_player_id] = p.name;
  const caps = r.events.captures.filter((c) => c.capturing_player_id != null && c.base_id >= 0);
  totalCaps += caps.length;
  const holdOf = (base: number, from: string) => r.base_ownership.find((p) => p.base_id === base && p.from_time === from)?.held_seconds ?? 0;
  // group by (time, team)
  const groups = new Map<string, typeof caps>();
  for (const c of caps) { const k = `${c.time}|${c.new_owner_team}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(c); }
  const roundAmbig: string[] = [];
  for (const [k, g] of groups) {
    const distinctPlayers = new Set(g.map((c) => c.capturing_player_id));
    const distinctBases = new Set(g.map((c) => c.base_id));
    if (distinctBases.size >= 2 && distinctPlayers.size >= 2) {
      // AMBIGUOUS: multiple players + multiple bases of the same team in the same second.
      ambiguousGroups++; ambiguousCaps += g.length;
      const holds = [...distinctBases].map((b) => { const c = g.find((x) => x.base_id === b)!; return { base: b, hold: holdOf(b, c.time) }; });
      const hv = holds.map((h) => h.hold); const disp = Math.max(...hv) - Math.min(...hv);
      maxDisparity = Math.max(maxDisparity, disp);
      roundAmbig.push(`  @${k}  players[${[...distinctPlayers].map((p) => name[p!]).join(", ")}]  bases+hold[${holds.map((h) => `${h.base}:${h.hold}s`).join(", ")}]  disparity=${disp}s`);
    }
  }
  // also count same-second groups where 2+ bases flip to same team (regardless of players)
  for (const [, g] of groups) if (new Set(g.map((c) => c.base_id)).size >= 2) sameSecondMultiTeam++;
  console.log(`\n=== ${f} === caps=${caps.length} ambiguousGroups=${roundAmbig.length}`);
  if (roundAmbig.length) console.log(roundAmbig.join("\n"));
  const flags = r.ingestion_flags.filter((x) => x.code === "capture_base_inferred");
  console.log(`  parser capture_base_inferred flags: ${flags.length}`);
}
console.log(`\n===== TOTALS =====`);
console.log(`captures=${totalCaps} | same-second same-team multi-base groups=${sameSecondMultiTeam}`);
console.log(`AMBIGUOUS (multi-player + multi-base, same team, same second): groups=${ambiguousGroups}, captures involved=${ambiguousCaps}`);
console.log(`Max hold-time disparity within an ambiguous group: ${maxDisparity}s`);
