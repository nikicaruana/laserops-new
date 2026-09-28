import { readFileSync } from "node:fs";
import { parseRound } from "../lib/ingestion/round-parser";
const caps: Record<string,number>={}, hold: Record<string,number>={};
for(let i=1;i<=5;i++){ const r=parseRound(readFileSync(`sample-game-data/r${i}.json`,"utf8"));
  const name: Record<number,string>={}; for(const p of r.players) name[p.in_game_player_id]=p.name;
  for(const [id,c] of Object.entries(r.final_player_counters)) caps[name[+id]]=(caps[name[+id]]||0)+c.captures;
  for(const [id,s] of Object.entries(r.hold_seconds)) hold[name[+id]]=(hold[name[+id]]||0)+Number(s);
}
const topCaps=Object.entries(caps).sort((a,b)=>b[1]-a[1]);
const topHold=Object.entries(hold).sort((a,b)=>b[1]-a[1]);
console.log("CAP-tain (most captures, whole match):"); topCaps.slice(0,4).forEach(([n,v],i)=>console.log(`  ${i+1}. ${n}: ${v}`));
console.log("Fortress (longest capture/hold time, whole match):"); topHold.slice(0,4).forEach(([n,v],i)=>console.log(`  ${i+1}. ${n}: ${v}s (${(v/60).toFixed(1)}min)`));
