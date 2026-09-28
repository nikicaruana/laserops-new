import { readFileSync } from "node:fs";
import { parseRound } from "../lib/ingestion/round-parser";
function ep(t:string){const m=t.match(/(\d+)\.(\d+)\.(\d+) (\d+):(\d+):(\d+)/);if(!m)return NaN;return Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6])/1000;}
// Inspect raw respawn signals directly, independent of the parser's Revivals logic.
for(let i=1;i<=5;i++){
  const text=readFileSync(`sample-game-data/r${i}.json`,"utf8");
  const r=parseRound(text,{spawnWindowSeconds:3});
  const name:Record<number,string>={}; for(const p of r.players) name[p.in_game_player_id]=p.name;
  // Raw scan: for each player, find HP->max transitions (a respawn signature) whether or not Revivals moved.
  const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const evs:{pid:number;ep:number;hp?:number;rev?:number;deaths?:number}[]=[];
  const maxHp=r.meta.max_hp;
  for(const l of lines){ let o:any; try{o=JSON.parse(l)}catch{continue;} if(o.ItemType!=="PlayerEvent")continue;
    const it=o.Item||{}; evs.push({pid:it.PlayerId,ep:ep(o.EventTime),hp:it.HP,rev:it.Revivals,deaths:it.Deaths}); }
  // Per player: count HP-to-max rises (excluding first), count Revivals rises, and total deaths.
  const byP:Record<number,typeof evs>={}; for(const e of evs){(byP[e.pid]??=[]).push(e);} 
  let hpResTot=0, revResTot=0;
  const perP:string[]=[];
  for(const pid of Object.keys(byP).map(Number)){
    const arr=byP[pid].sort((a,b)=>a.ep-b.ep);
    let prevHp:number|undefined, prevRev=0, hpRes=0, revRes=0, first=true;
    for(const e of arr){
      if(e.hp!=null){ if(!first && prevHp!=null && prevHp<maxHp && e.hp===maxHp) hpRes++; if(e.hp!=null) prevHp=e.hp; first=false; }
      if(e.rev!=null && e.rev>prevRev){ revRes++; prevRev=e.rev; }
    }
    const deaths=r.final_player_counters[pid]?.deaths??0;
    hpResTot+=hpRes; revResTot+=revRes;
    perP.push(`${name[pid]}: deaths=${deaths} hpRises=${hpRes} revRises=${revRes} parserRespawns=${r.events.respawns.filter(x=>x.player_id===pid).length}`);
  }
  // Kill timing distribution vs most-recent HP-rise respawn (using hp-rise as truth)
  const hpRespawns:Record<number,number[]>={};
  for(const pid of Object.keys(byP).map(Number)){
    const arr=byP[pid].sort((a,b)=>a.ep-b.ep); let prevHp:number|undefined, first=true; const list:number[]=[];
    for(const e of arr){ if(e.hp!=null){ if(!first&&prevHp!=null&&prevHp<maxHp&&e.hp===maxHp) list.push(e.ep); prevHp=e.hp; first=false; } }
    hpRespawns[pid]=list;
  }
  const lastRes=(v:number,t:number)=>{const a=hpRespawns[v]||[];let b:number|null=null;for(const x of a){if(x<=t)b=x;else break;}return b;};
  const dist:Record<string,number>={}; const winCount={w3:0,w4:0,w5:0};
  for(const k of r.events.kills){ const t=ep(k.time); const rs=lastRes(k.victim_id,t); if(rs==null){dist["no-respawn"]=(dist["no-respawn"]||0)+1;continue;}
    const d=t-rs; const key=d<=6?String(d):"7+"; dist[key]=(dist[key]||0)+1;
    if(d<=3)winCount.w3++; if(d<=4)winCount.w4++; if(d<=5)winCount.w5++; }
  console.log(`\n=== R${i} (winner ${r.result.winner_team}) maxHp=${maxHp} kills=${r.events.kills.length} ===`);
  console.log(`totals: hpRises=${hpResTot} revRises=${revResTot} parserSpawnKills=${Object.values(r.spawn_kills_by).reduce((a,b)=>a+b,0)}`);
  console.log(`kill delay after HP-rise respawn (secs):`, JSON.stringify(dist));
  console.log(`spawn kills by window (HP-rise truth): 3s=${winCount.w3} 4s=${winCount.w4} 5s=${winCount.w5}`);
  console.log(perP.join("\n"));
}
