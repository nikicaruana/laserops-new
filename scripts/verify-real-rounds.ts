import { readFileSync } from "node:fs";
import { parseRound } from "../lib/ingestion/round-parser";

const EXPECT: Record<string,string> = { "1":"Yellow","2":"Yellow","3":"Blue","4":"Yellow","5":"Blue" };
const CHECK: [keyof import("../lib/ingestion/round-parser").PlayerCounters,string][] =
  [["frags","PlayerFragsCount"],["deaths","PlayerDeathsCount"],["hits","PlayerHitsCount"],
   ["shots","PlayerShotsCount"],["revivals","PlayerRevivalsCount"],["captures","PlayerDeviceCapturingsCount"],
   ["wounds","PlayerWoundsCount"]];

let totalMismatch = 0;
for (const R of ["1","2","3","4","5"]) {
  const round = parseRound(readFileSync(`sample-game-data/r${R}.json`,"utf8"));
  const nameById: Record<number,string> = {};
  for (const p of round.players) nameById[p.in_game_player_id] = p.name;
  // burns + winner
  const w = round.result.winner_team;
  const exp = EXPECT[R];
  const burnStr = round.result.burns.map(b=>`${round.bases.find(x=>x.device_id===b.base_id)?.nickname||b.base_id}:${b.team}`).join(", ");
  const ok = w===exp ? "OK" : "*** MISMATCH ***";
  console.log(`\n=== R${R} winner=${w} (expected ${exp}) ${ok}  allBurned=${round.result.all_bases_burned}  burns=[${burnStr}]  flags=[${round.ingestion_flags.map(f=>f.code+(f.detail?`:${f.detail}`:"")).join("; ")}]`);
  // counters vs csv (skip R1 - no csv)
  if (R==="1") { console.log("  (no CSV for R1)"); continue; }
  const csv = readFileSync(`sample-game-data/r${R}.csv`,"utf8").split(/\r?\n/).filter(l=>l.trim());
  const h = csv[0].split(","); const iNick=h.indexOf("PlayerNickName");
  const byNick: Record<string,string[]> = {};
  for (const line of csv.slice(1)){ const c=line.split(","); byNick[c[iNick]]=c; }
  let mism=0;
  for (const [id,ctr] of Object.entries(round.final_player_counters)){
    const name = nameById[+id]; const c = byNick[name]; if(!c) { console.log(`   ! no csv row for ${name}`); continue; }
    for (const [k,col] of CHECK){ const got=(ctr as any)[k]; const want=Number(c[h.indexOf(col)]);
      if (got!==want){ mism++; console.log(`   MISMATCH ${name} ${k}: parser ${got} vs csv ${want}`); } }
  }
  console.log(`  per-player counters: ${mism===0?"ALL MATCH ✓":mism+" mismatches"}`);
  totalMismatch += mism + (w===exp?0:1);
}
console.log(`\n${totalMismatch===0?"ALL GREEN ✓ (counters + winners)":"TOTAL ISSUES: "+totalMismatch}`);
