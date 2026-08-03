/**
 * scripts/verify-parser.ts
 * --------------------------------------------------------------------
 * Verifies lib/ingestion/round-parser against the reference fixture (round-B)
 * using the numbers the parsing pack verifies by hand. Run:
 *   npx tsx scripts/verify-parser.ts
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseRound } from "../lib/ingestion/round-parser";

const here = dirname(fileURLToPath(import.meta.url));
const text = readFileSync(join(here, "../lib/ingestion/__fixtures__/round-B.json"), "utf8");

const round = parseRound(text);

let pass = 0;
let fail = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "✓" : "✗"} ${label}: ${JSON.stringify(actual)}${ok ? "" : ` (expected ${JSON.stringify(expected)})`}`);
  ok ? pass++ : fail++;
}

check("player_count", round.meta.player_count, 4);
check("team_count", round.meta.team_count, 2);
check("teams", round.teams.map((t) => `${t.colour}:${t.name}`), ["Yellow:Noob Power", "Blue:Alpha Impact"]);
check("base count", round.bases.length, 3);
check("player ids", round.players.map((p) => p.in_game_player_id), [4, 5, 6, 7]);
check("headbands", round.players.map((p) => p.headband_no), [4, 34, 20, 43]);
check("kills", round.events.kills.length, 26);
check("hits (damage)", round.events.damage.length, 201);
check("captures total", round.events.captures.length, 30);
check("captures all attributed", round.events.captures.every((c) => c.capturing_player_id !== null && c.base_id !== -1), true);
check("max_hp", round.meta.max_hp, 150);
check("inferred_mode", round.scenario.inferred_mode, "capture/domination");

// Longest continuous hold per base (pack: base1 236, base2 309, base3 496).
const longest = (bid: number) =>
  Math.max(0, ...round.base_ownership.filter((o) => o.base_id === bid).map((o) => o.held_seconds));
check("longest hold base 1", longest(1), 236);
check("longest hold base 2", longest(2), 309);
check("longest hold base 3", longest(3), 496);

// Damage dealt per player (JSON-accurate: Σ actual per-hit damage).
check("damage dealt by ids", [4, 5, 6, 7].map((p) => round.damage_dealt[p]), [250, 1075, 475, 2600]);
check("Σ hold seconds > 0", Object.values(round.hold_seconds).reduce((a, b) => a + b, 0) > 0, true);

// Cross-check sums.
const sumFrags = Object.values(round.final_player_counters).reduce((a, c) => a + c.frags, 0);
const sumCaps = Object.values(round.final_player_counters).reduce((a, c) => a + c.captures, 0);
check("Σ final frags", sumFrags, 26);
check("Σ final captures", sumCaps, 30);

console.log("\ningestion_flags:", JSON.stringify(round.ingestion_flags));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
