/**
 * scripts/build-match-report.ts
 * Parse a folder of round JSON (r*.json) and write a bundled Match Report v2
 * artifact the site can render without a DB. Re-run when the parser/scoring
 * changes or for a new batch.
 *
 *   npx tsx scripts/build-match-report.ts <dataDir> <matchId> <label>
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { buildMatchReportV2 } from "../lib/match-report-v2/build";

const DATA_DIR = process.argv[2] || "sample-game-data";
const MATCH_ID = process.argv[3] || "LO-2026-27";
const LABEL = process.argv[4] || "LO-2026-27 · 5v5 Online Domination";

const files = readdirSync(DATA_DIR).filter((f) => /^r\d+\.json$/i.test(f)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
if (files.length === 0) { console.error(`No r*.json in ${DATA_DIR}`); process.exit(1); }
const rawRounds = files.map((f) => ({ raw: readFileSync(`${DATA_DIR}/${f}`, "utf8") }));

const report = buildMatchReportV2(rawRounds, { matchId: MATCH_ID, label: LABEL });

const outDir = "lib/match-report-v2/reports";
mkdirSync(outDir, { recursive: true });
const out = `${outDir}/${MATCH_ID}.json`;
writeFileSync(out, JSON.stringify(report, null, 2));

console.log(`Wrote ${out}`);
console.log(`Rounds: ${report.roundCount} | winner: ${report.matchWinner} (${JSON.stringify(report.roundsWonByTeam)})`);
console.log(`Players: ${report.players.length}`);
console.log("Top 3 by total:", report.players.slice(0, 3).map((p) => `${p.name} ${p.totalScore}`).join(", "));
console.log("Accolades:", report.accolades.map((a) => `${a.name}=${a.winnerName}(${a.value})`).join(", "));
