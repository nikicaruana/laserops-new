import { readFileSync } from "node:fs";
import { parseRound } from "../lib/ingestion/round-parser";
import { tradedCapsByPlayer } from "../lib/ingestion/trades";
const raw:Record<string,number>={}, traded:Record<string,number>={}, hold:Record<string,number>={};
for(let i=1;i<=5;i++){ const r=parseRound(readFileSync(`sample-game-data/r${i}.json`,"utf8"));
  const name:Record<number,string>={}; for(const p of r.players) name[p.in_game_player_id]=p.name;
  for(const [id,c] of Object.entries(r.final_player_counters)) raw[name[+id]]=(raw[name[+id]]||0)+c.captures;
  const t=tradedCapsByPlayer(r,5); for(const [id,n] of Object.entries(t)) traded[name[+id]]=(traded[name[+id]]||0)+n;
  for(const [id,s] of Object.entries(r.hold_seconds)) hold[name[+id]]=(hold[name[+id]]||0)+Number(s);
}
const rows=Object.keys(raw).map(n=>({n,raw:raw[n],traded:traded[n]||0,eff:raw[n]-(traded[n]||0),hold:hold[n]||0}));
console.log("CAP-tain candidates (raw / traded / effective / holdSec):");
rows.sort((a,b)=>b.eff-a.eff||b.hold-a.hold).forEach(r=>console.log(`  ${r.n}: raw ${r.raw} / trades ${r.traded} / EFFECTIVE ${r.eff} / hold ${r.hold}s`));
