/**
 * scripts/combined-csv.ts
 * --------------------------------------------------------------------
 * Build ONE combined per-player CSV for a match, in the EXACT schema of the
 * LaserWar round-export CSVs (53 columns), aggregating all rounds together
 * (one row per player). No scoring is computed here — the live Google Sheet
 * does that. Player counters are summed across rounds; accuracy is recomputed
 * from summed hits/shots; MaxFragSeries is the max across rounds; team totals
 * are summed; match winner = team that won the most rounds (by burns).
 *
 *   npx tsx scripts/combined-csv.ts <dataDir> <matchLabel>
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { parseRound, type Round } from "../lib/ingestion/round-parser";

const DATA_DIR = process.argv[2] || "sample-game-data";
const MATCH_LABEL = process.argv[3] || "LO-2026-27";

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

function csvRows(f: string): Record<string, string>[] {
  const t = readFileSync(`${DATA_DIR}/${f}`, "utf8").split(/\r?\n/).filter(Boolean);
  const h = t[0].split(",");
  return t.slice(1).map((line) => { const c = line.split(","); const o: Record<string, string> = {}; h.forEach((k, j) => (o[k] = c[j] ?? "")); return o; });
}
function ep(t: string) { const m = t.match(/(\d+)\.(\d+)\.(\d+) (\d+):(\d+):(\d+)/); if (!m) return NaN; return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000; }
function maxFragSeries(r: Round, pid: number): number {
  const evs = [
    ...r.events.kills.filter((k) => k.actor_id === pid).map((k) => ({ e: ep(k.time), kill: true })),
    ...r.events.kills.filter((k) => k.victim_id === pid).map((k) => ({ e: ep(k.time), kill: false })),
  ].sort((a, b) => a.e - b.e || (a.kill === b.kill ? 0 : a.kill ? -1 : 1));
  let run = 0, best = 0; for (const x of evs) { if (x.kill) { run++; best = Math.max(best, run); } else run = 0; } return best;
}
function fmtDur(s: number) { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`; }

const roundFiles = readdirSync(DATA_DIR).filter((f) => /^r\d+\.json$/i.test(f)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
console.log(`Rounds: ${roundFiles.join(", ")}`);

type P = { nick: string; team: string; weapons: string[]; rate: number; deaths: number; frags: number; teamKills: number; hits: number; revivals: number; caps: number; shots: number; wounds: number; treatments: number; maxSeries: number };
const players: Record<string, P> = {};
const roundWins: Record<string, number> = {};
let firstStart = "", totalDur = 0;

for (let i = 0; i < roundFiles.length; i++) {
  const r = parseRound(readFileSync(`${DATA_DIR}/${roundFiles[i]}`, "utf8"), { spawnWindowSeconds: 3 });
  if (i === 0) firstStart = r.meta.start_time ?? "";
  totalDur += r.meta.duration_seconds ?? 0;
  if (r.result.winner_team) roundWins[r.result.winner_team] = (roundWins[r.result.winner_team] ?? 0) + 1;
  for (const pl of r.players) {
    const c = r.final_player_counters[pl.in_game_player_id]; if (!c) continue;
    const key = pl.name; // "Head NN"
    const p = (players[key] ??= { nick: pl.name, team: pl.team, weapons: [], rate: 0, deaths: 0, frags: 0, teamKills: 0, hits: 0, revivals: 0, caps: 0, shots: 0, wounds: 0, treatments: 0, maxSeries: 0 });
    p.team = pl.team;
    p.rate += c.score; p.deaths += c.deaths; p.frags += c.frags; p.hits += c.hits; p.revivals += c.revivals;
    p.caps += c.captures; p.shots += c.shots; p.wounds += c.wounds; p.treatments += c.treatments;
    p.maxSeries = Math.max(p.maxSeries, maxFragSeries(r, pl.in_game_player_id));
  }
}

// Sanity: JSON-derived per-player counters must equal the round CSVs that exist.
let mism = 0;
for (const f of roundFiles) {
  const csvName = f.replace(/\.json$/i, ".csv");
  let rows: Record<string, string>[]; try { rows = csvRows(csvName); } catch { continue; }
  const r = parseRound(readFileSync(`${DATA_DIR}/${f}`, "utf8"), { spawnWindowSeconds: 3 });
  for (const row of rows) {
    const pl = r.players.find((x) => x.name === row.PlayerNickName); if (!pl) continue;
    const c = r.final_player_counters[pl.in_game_player_id];
    const check: [string, number, number][] = [
      ["frags", c.frags, +row.PlayerFragsCount], ["deaths", c.deaths, +row.PlayerDeathsCount],
      ["hits", c.hits, +row.PlayerHitsCount], ["shots", c.shots, +row.PlayerShotsCount],
      ["wounds", c.wounds, +row.PlayerWoundsCount], ["caps", c.captures, +row.PlayerDeviceCapturingsCount],
      ["revivals", c.revivals, +row.PlayerRevivalsCount],
      ["maxseries", maxFragSeries(r, pl.in_game_player_id), +row.PlayerMaxFragSeries],
    ];
    for (const [k, a, b] of check) if (a !== b) { console.log(`  MISMATCH ${csvName} ${row.PlayerNickName} ${k}: json ${a} vs csv ${b}`); mism++; }
  }
}
console.log(mism === 0 ? "Sanity: JSON-derived counters match all existing round CSVs exactly." : `Sanity: ${mism} mismatches (see above).`);

// Constant game/team columns copied verbatim from an existing round CSV for fidelity.
const sample = csvRows(roundFiles.map((f) => f.replace(/\.json$/i, ".csv")).find((c) => { try { readFileSync(`${DATA_DIR}/${c}`); return true; } catch { return false; } })!);
const g = sample[0];
const teamNameByColour: Record<string, string> = {};
for (const row of sample) teamNameByColour[row.TeamColor] = row.TeamName;

// Team totals = sum of player totals within each colour.
const teamTot: Record<string, { rate: number; deaths: number; frags: number; hits: number; revivals: number; caps: number; treatments: number }> = {};
for (const p of Object.values(players)) {
  const t = (teamTot[p.team] ??= { rate: 0, deaths: 0, frags: 0, hits: 0, revivals: 0, caps: 0, treatments: 0 });
  t.rate += p.rate; t.deaths += p.deaths; t.frags += p.frags; t.hits += p.hits; t.revivals += p.revivals; t.caps += p.caps; t.treatments += p.treatments;
}
const winner = Object.entries(roundWins).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
console.log(`Round wins: ${JSON.stringify(roundWins)} -> match winner: ${winner}`);

// Weapon + RatePoints per player from the round CSVs (rate points are game-computed
// and NOT present in the JSON, so they can only come from the CSVs — R2–R5 here,
// as there is no R1 CSV). Weapon = most recent non-empty across rounds.
const weaponByNick: Record<string, string> = {};
const rateByNick: Record<string, number> = {};
let rateRoundsCovered = 0, rateRoundsTotal = roundFiles.length;
for (const f of roundFiles) { const csvName = f.replace(/\.json$/i, ".csv"); let rows: Record<string, string>[]; try { rows = csvRows(csvName); } catch { continue; }
  rateRoundsCovered++;
  for (const row of rows) { if (row.PlayerWeapons) weaponByNick[row.PlayerNickName] = row.PlayerWeapons;
    rateByNick[row.PlayerNickName] = (rateByNick[row.PlayerNickName] ?? 0) + (+row.PlayerRatePoints || 0); } }
const teamRateByColour: Record<string, number> = {};
for (const p of Object.values(players)) teamRateByColour[p.team] = (teamRateByColour[p.team] ?? 0) + (rateByNick[p.nick] ?? 0);
if (rateRoundsCovered < rateRoundsTotal) console.log(`NOTE: PlayerRatePoints covers ${rateRoundsCovered}/${rateRoundsTotal} rounds (no CSV for the rest); all other columns cover all ${rateRoundsTotal}.`);

function esc(v: string | number) { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
const lines = [HEADER.join(",")];
// Group players by team so the file reads like the round exports (team block order).
const ordered = Object.values(players).sort((a, b) => (a.team === b.team ? a.nick.localeCompare(b.nick) : a.team.localeCompare(b.team)));
for (const p of ordered) {
  const tt = teamTot[p.team];
  const acc = p.shots > 0 ? (p.hits / p.shots).toFixed(2) : "0.00";
  const weapon = weaponByNick[p.nick] ?? "Default";
  const row: (string | number)[] = [
    "", g.ClubId, g.Generation, MATCH_LABEL, g.ScenarioName, g.ScenarioType, firstStart, fmtDur(totalDur),
    g.FriendlyFireMode, g.IRSensorMode, g.BackgroundBrightness, g.DamagedGlowColor, g.RestoreCatridgesOnRespawn, g.VampireMode,
    g.TeamsCount, g.DeathPoints, g.FragPoints, g.KillTeammatePoints, g.HitPoints, g.RevivePoints, g.FlagSetPoints,
    g.DeviceCapturedPoints, g.DeviceDestroyPoints, g.DeviceKeepingPoints, g.GameFinishCondition,
    teamNameByColour[p.team] ?? "", p.team, p.team === winner ? "True" : "False",
    teamRateByColour[p.team] ?? 0, tt.deaths, tt.frags, 0, tt.hits, tt.revivals, tt.caps, tt.treatments,
    "", p.nick, "", "Default", weapon, rateByNick[p.nick] ?? 0, p.deaths, p.frags, 0, p.hits, p.revivals, p.caps,
    acc, p.shots, p.wounds, p.treatments, p.maxSeries,
  ];
  lines.push(row.map(esc).join(","));
}
const out = `${DATA_DIR}/LaserOps-Match-${MATCH_LABEL}-combined.csv`;
writeFileSync(out, lines.join("\r\n") + "\r\n");
console.log(`\nWrote ${out} (${ordered.length} players)`);
console.log(lines.slice(0, 3).join("\n"));
