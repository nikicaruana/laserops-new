/* eslint-disable */
// LO-2026-31 merged CSV from all 6 round LWAs (game-authoritative). Includes the
// prematurely-ended round's player stats in the totals; match winner = Yellow
// (from the 5 REAL rounds: R1 Y, R2 B, R3 B, R4 Y, R5 Y). One row per headband.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseLwa } from "../lib/ingestion/lwa";

const DIR = "C:/Users/nikic/AppData/Local/Temp/claude/C--Users-nikic-Documents-Laseropsmalta-com-laserops-new--claude-worktrees-beautiful-bouman-66c3b3/f0f41fbf-4edc-4679-b4aa-7e0e88372652/scratchpad/LO-2026-31";
const MATCH = "LO-2026-31";
const WINNER_COLOR = "Yellow";

const lwaFiles = readdirSync(`${DIR}/lwas`).filter((f) => f.toLowerCase().endsWith(".lwa")).sort();
const lwas = lwaFiles.map((f) => parseLwa(readFileSync(`${DIR}/lwas/${f}`, "utf8")) as any);
console.log(`LWAs (all ${lwaFiles.length}, incl. premature round):`, lwaFiles.join(", "));

const HEADER = [
  "SecurityIdentifier","ClubId","Generation","GameId","ScenarioName","ScenarioType","GameStartTime","GameDuration",
  "FriendlyFireMode","IRSensorMode","BackgroundBrightness","DamagedGlowColor","RestoreCatridgesOnRespawn","VampireMode",
  "TeamsCount","DeathPoints","FragPoints","KillTeammatePoints","HitPoints","RevivePoints","FlagSetPoints",
  "DeviceCapturedPoints","DeviceDestroyPoints","DeviceKeepingPoints","GameFinishCondition",
  "TeamName","TeamColor","IsWinner","TeamRatePoints","TeamDeathsCount","TeamFragsCount","TeamTeammateKillsCount",
  "TeamHitsCount","TeamRevivalsCount","TeamDeviceCapturingsCount","TeamTreatmentsCount",
  "PlayerName","PlayerNickName","PlayerPhoneNumber","PlayerRole","PlayerWeapons","PlayerRatePoints","PlayerDeathsCount",
  "PlayerFragsCount","PlayerTeammateKillsCount","PlayerHitsCount","PlayerRevivalsCount","PlayerDeviceCapturingsCount",
  "PlayerAccuracy","PlayerShotsCount","PlayerWoundsCount","PlayerTreatmentsCount","PlayerMaxFragSeries",
];

type P = { nick: string; color: string; weapon: string; rate: number; deaths: number; frags: number; teamKills: number; hits: number; revivals: number; caps: number; shots: number; wounds: number; treatments: number; maxSeries: number };
const players: Record<string, P> = {};
const teamColorName: Record<string, string> = {};
let durSeconds = 0, firstStart = "";
const g0 = lwas[0];
const durToSec = (d: string) => { const m = /^(\d+):(\d{2}):(\d{2})$/.exec(String(d ?? "").trim()); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0; };
const fmtDur = (s: number) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`; };

lwas.forEach((g, i) => {
  if (i === 0) firstStart = String(g.GameStartTime ?? "");
  durSeconds += durToSec(g.GameDuration);
  for (const t of g.Teams ?? []) {
    teamColorName[String(t.Color)] = String(t.Name ?? "");
    for (const p of t.Players ?? []) {
      const key = String(p.NickName ?? p.Name ?? "");
      if (!key) continue;
      const rec = (players[key] ??= { nick: key, color: String(t.Color), weapon: "", rate: 0, deaths: 0, frags: 0, teamKills: 0, hits: 0, revivals: 0, caps: 0, shots: 0, wounds: 0, treatments: 0, maxSeries: 0 });
      rec.color = String(t.Color);
      const w = (p.Weapons ?? []).map((x: any) => x?.Type).filter(Boolean).join("/"); if (w) rec.weapon = w;
      rec.rate += +p.RatePoints || 0; rec.deaths += +p.DeathsCount || 0; rec.frags += +p.FragsCount || 0; rec.teamKills += +p.TeammateKillsCount || 0;
      rec.hits += +p.HitsCount || 0; rec.revivals += +p.RevivalsCount || 0; rec.caps += +p.DeviceCapturingsCount || 0;
      rec.shots += +p.ShotsCount || 0; rec.wounds += +p.WoundsCount || 0; rec.treatments += +p.TreatmentsCount || 0;
      rec.maxSeries = Math.max(rec.maxSeries, +p.MaxFragSeries || 0);
    }
  }
});

const teamTot: Record<string, any> = {};
for (const p of Object.values(players)) { const t = (teamTot[p.color] ??= { rate: 0, deaths: 0, frags: 0, teamKills: 0, hits: 0, revivals: 0, caps: 0, treatments: 0 });
  t.rate += p.rate; t.deaths += p.deaths; t.frags += p.frags; t.teamKills += p.teamKills; t.hits += p.hits; t.revivals += p.revivals; t.caps += p.caps; t.treatments += p.treatments; }

const esc = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const lines = [HEADER.join(",")];
const ordered = Object.values(players).sort((a, b) => (a.color === b.color ? a.nick.localeCompare(b.nick, undefined, { numeric: true }) : a.color.localeCompare(b.color)));
for (const p of ordered) {
  const tt = teamTot[p.color]; const acc = p.shots > 0 ? (p.hits / p.shots).toFixed(2) : "0.00";
  const row: (string | number)[] = [
    "", g0.ClubId, g0.Generation, MATCH, g0.ScenarioName, g0.ScenarioType, firstStart, fmtDur(durSeconds),
    g0.FriendlyFireMode, g0.IRSensorMode, g0.BackgroundBrightness, g0.DamagedGlowColor, g0.RestoreCatridgesOnRespawn, g0.VampireMode,
    g0.TeamsCount, g0.DeathPoints, g0.FragPoints, g0.KillTeammatePoints, g0.HitPoints, g0.RevivePoints, g0.FlagSetPoints,
    g0.DeviceCapturedPoints, g0.DeviceDestroyPoints, g0.DeviceKeepingPoints, g0.GameFinishCondition,
    teamColorName[p.color] ?? "", p.color, p.color === WINNER_COLOR ? "True" : "False",
    tt.rate, tt.deaths, tt.frags, tt.teamKills, tt.hits, tt.revivals, tt.caps, tt.treatments,
    "", p.nick, "", "Default", p.weapon || "Default", p.rate, p.deaths, p.frags, p.teamKills, p.hits, p.revivals, p.caps,
    acc, p.shots, p.wounds, p.treatments, p.maxSeries,
  ];
  lines.push(row.map(esc).join(","));
}
const out = `${DIR}/LaserOps-Match-${MATCH}-combined.csv`;
writeFileSync(out, lines.join("\r\n") + "\r\n");
console.log(`\nWrote ${out} (${ordered.length} players, total dur ${fmtDur(durSeconds)})`);
console.log("\nPlayer      Tm    K   D   Hits  Shots Caps Acc");
for (const p of ordered) console.log(`  ${p.nick.padEnd(9)} ${p.color.padEnd(6)} ${String(p.frags).padStart(3)} ${String(p.deaths).padStart(3)} ${String(p.hits).padStart(5)} ${String(p.shots).padStart(5)} ${String(p.caps).padStart(4)} ${p.shots ? (p.hits / p.shots * 100).toFixed(0) : "0"}%`);
console.log(`\n  Totals: frags ${Object.values(players).reduce((s, p) => s + p.frags, 0)} (incl. premature round)`);
