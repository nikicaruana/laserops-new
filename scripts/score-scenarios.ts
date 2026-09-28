import { readFileSync } from "node:fs";
import { parseRound, type Round } from "../lib/ingestion/round-parser";
const MIN_HOLD=5, RECAP_WINDOW=20;
function ep(t:string){const m=t.match(/(\d+)\.(\d+)\.(\d+) (\d+):(\d+):(\d+)/)!;return Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6])/1000;}
type Agg={frags:number;damage:number;hits:number;shots:number;deaths:number;capN:number;recapN:number;hold:number;rawCap:number;excl:number};
const agg:Record<string,Agg>={};
const A=(n:string)=>agg[n]??=(agg[n]={frags:0,damage:0,hits:0,shots:0,deaths:0,capN:0,recapN:0,hold:0,rawCap:0,excl:0});
for(let i=1;i<=5;i++){
  const r:Round=parseRound(readFileSync(`sample-game-data/r${i}.json`,"utf8"),{spawnWindowSeconds:3});
  const name:Record<number,string>={}; for(const p of r.players) name[p.in_game_player_id]=p.name;
  for(const p of r.players){ const c=r.final_player_counters[p.in_game_player_id]; if(!c)continue;
    const sk=r.spawn_kills_by[p.in_game_player_id]||0, sd=r.spawn_damage_by[p.in_game_player_id]||0; const a=A(p.name);
    a.frags+=Math.max(0,c.frags-sk); a.damage+=Math.max(0,(r.damage_dealt[p.in_game_player_id]||0)-sd);
    a.hits+=c.hits; a.shots+=c.shots; a.deaths+=c.deaths; a.rawCap+=c.captures; }
  const periodOf=(base:number,from:string)=>r.base_ownership.find(p=>p.base_id===base && p.from_time===from);
  const burnEp:Record<number,number>={}; for(const b of r.result.burns) burnEp[b.base_id]=b.burn_epoch;
  const valid:{pid:number;base:number;t:number;held:number}[]=[];
  for(const cap of r.events.captures){ if(cap.capturing_player_id==null||cap.base_id<0)continue;
    const per=periodOf(cap.base_id,cap.time); const held=per?per.held_seconds:0; const ct=ep(cap.time);
    const toT=per&&per.to_time?ep(per.to_time):ct+held;
    const burnIn=burnEp[cap.base_id]!=null && burnEp[cap.base_id]>=ct-1 && burnEp[cap.base_id]<=toT+1;
    if(held<MIN_HOLD && !burnIn){ A(name[cap.capturing_player_id]).excl++; continue; }
    valid.push({pid:cap.capturing_player_id,base:cap.base_id,t:ct,held}); }
  const last:Record<string,number>={}; valid.sort((a,b)=>a.t-b.t);
  for(const v of valid){ const a=A(name[v.pid]); a.hold+=v.held; const k=`${v.pid}:${v.base}`;
    if(last[k]!=null && v.t-last[k]<=RECAP_WINDOW) a.recapN++; else a.capN++; last[k]=v.t; }
}
function killScore(a:Agg){const acc=a.shots>0?a.hits/a.shots:0,kd=a.deaths>0?a.frags/a.deaths:a.frags;return Math.round((a.frags*50+a.damage*0.2)*(1+acc*0.2)*(1+kd*0.12));}
const OBJ=(a:Agg,cap:number,recap:number,hold:number)=>a.capN*cap+a.recapN*recap+a.hold*hold; // OBJECTIVE ONLY
const rows=Object.entries(agg).map(([n,a])=>({n,a,ks:killScore(a),
  A:OBJ(a,200,180,2),B:OBJ(a,75,50,2),C:OBJ(a,75,50,3),D:OBJ(a,50,30,2)}));
rows.sort((x,y)=>(y.ks+y.B)-(x.ks+x.B));
console.log("OBJECTIVE-ONLY per scenario (add Kill score for totals). Hold in seconds.");
console.log("player  | K  D  caps(rc) hold(s) | KillScr | A obj | B obj | C obj(h3) | D obj");
for(const {n,a,ks,A:oA,B:oB,C:oC,D:oD} of rows)
  console.log(`${n.padEnd(7)}| ${String(a.frags).padStart(2)} ${String(a.deaths).padStart(2)} ${String(a.capN).padStart(3)}(${a.recapN}) ${String(a.hold).padStart(5)}  | ${String(ks).padStart(5)}   | ${String(oA).padStart(5)} | ${String(oB).padStart(5)} | ${String(oC).padStart(5)}     | ${String(oD).padStart(5)}`);
