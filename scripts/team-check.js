const fs=require("fs");
function rows(f){const t=fs.readFileSync(`sample-game-data/${f}`,"utf8").split(/\r?\n/).filter(Boolean);
  const h=t[0].split(",");const out=[];for(let i=1;i<t.length;i++){const c=t[i].split(",");const o={};h.forEach((k,j)=>o[k]=c[j]);out.push(o);}return out;}
const files=["r2.csv","r3.csv","r4.csv","r5.csv"];
const teamByPlayer={};
for(const f of files){for(const r of rows(f)){const p=r.PlayerNickName;(teamByPlayer[p]??={})[f]=r.TeamColor;}}
for(const p of Object.keys(teamByPlayer).sort()){const t=teamByPlayer[p];const set=new Set(Object.values(t).filter(Boolean));
  console.log(`${p.padEnd(9)}: ${files.map(f=>(t[f]||"-").padEnd(6)).join(" ")}  ${set.size>1?"<< SWITCHED":""}`);}
