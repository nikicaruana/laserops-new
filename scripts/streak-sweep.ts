import { readFileSync } from "node:fs";
import { parseRound } from "../lib/ingestion/round-parser";
import { detectStreaks, STREAK_NAMES } from "../lib/ingestion/streaks";

const tally: Record<string, number[]> = {};
for (const k of Object.keys(STREAK_NAMES)) tally[k] = [0,0,0,0,0];
for (let i=0;i<5;i++){
  const R=String(i+1);
  const round = parseRound(readFileSync(`sample-game-data/r${R}.json`,"utf8"));
  const s = detectStreaks(round);
  for (const a of s) tally[a.key][i]++;
}
console.log("streak_key".padEnd(18), "R1 R2 R3 R4 R5  TOTAL");
for (const k of Object.keys(STREAK_NAMES)){
  const t = tally[k]; const sum=t.reduce((a,b)=>a+b,0);
  const mark = sum===0 ? "  <-- NEVER FIRES" : "";
  console.log(k.padEnd(18), t.map(n=>String(n).padStart(2)).join(" "), " ", String(sum).padStart(4), mark);
}
