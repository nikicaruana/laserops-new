/**
 * scripts/replay-sim.ts
 * --------------------------------------------------------------------
 * Rehearse the live feed WITHOUT a real game: drip the sample round files into a
 * target folder line-by-line over time, exactly like AlphaTag writing them
 * during play. Point the watcher at that folder (start it first, on an empty
 * folder) and watch the player/admin live views populate.
 *
 *   npx tsx scripts/replay-sim.ts <targetFolder> [secondsPerRound=25] [gapSeconds=4]
 *
 * Example:
 *   1. mkdir C:\live-test   (empty folder)
 *   2. run the watcher pointed at C:\live-test   (start match live + feed on)
 *   3. npx tsx scripts/replay-sim.ts C:\live-test 25
 */
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const SRC = "sample-game-data";
const target = process.argv[2];
const secondsPerRound = Number(process.argv[3] ?? 25) || 25;
const gapSeconds = Number(process.argv[4] ?? 4) || 4;

if (!target) { console.error("Usage: npx tsx scripts/replay-sim.ts <targetFolder> [secondsPerRound] [gapSeconds]"); process.exit(1); }
if (!existsSync(SRC)) { console.error(`Source folder not found: ${SRC}`); process.exit(1); }
mkdirSync(target, { recursive: true });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const files = readdirSync(SRC).filter((f) => /^r\d+\.json$/i.test(f)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
  if (files.length === 0) { console.error("No r*.json files in sample-game-data."); process.exit(1); }
  console.log(`Replaying ${files.length} rounds into ${target} — ~${secondsPerRound}s each.\nStart the watcher on this (empty) folder first, with the match live + feed on.\n`);

  for (const name of files) {
    const lines = readFileSync(join(SRC, name), "utf8").split(/\r?\n/);
    const dest = join(target, name);
    writeFileSync(dest, ""); // fresh file — watcher treats it as a new round
    const ticks = Math.max(1, Math.round(secondsPerRound)); // ~1 write/sec
    const perTick = Math.ceil(lines.length / ticks);
    let i = 0;
    process.stdout.write(`\n${name}: `);
    while (i < lines.length) {
      const chunk = lines.slice(i, i + perTick).join("\n");
      appendFileSync(dest, (i === 0 ? "" : "\n") + chunk);
      i += perTick;
      process.stdout.write(`${Math.min(100, Math.round((i / lines.length) * 100))}% `);
      if (i < lines.length) await sleep(1000);
    }
    console.log(`done (${lines.length} lines).`);
    if (name !== files[files.length - 1]) { console.log(`  ...next round in ${gapSeconds}s`); await sleep(gapSeconds * 1000); }
  }
  console.log("\nReplay finished.");
}
main().catch((e) => { console.error(e); process.exit(1); });
