/**
 * lib/ingestion/lwa.ts
 * --------------------------------------------------------------------
 * Convert a LaserWar/AlphaTag ".lwa" statistics file (nested JSON: game →
 * Teams[] → Players[]) into the flat one-row-per-player CSV the rest of the
 * pipeline expects — the same transform the old external script did, now
 * in-app. Pure + defensive (all values are strings in the source).
 */

type LwaPlayer = Record<string, unknown> & { Weapons?: { Type?: string }[] };
type LwaTeam = Record<string, unknown> & { Players?: LwaPlayer[] };
export type LwaGame = Record<string, unknown> & { Teams?: LwaTeam[] };

/** The flat CSV column order (matches the LaserWar CSV export). */
export const LWA_CSV_HEADER = [
  "SecurityIdentifier", "ClubId", "Generation", "GameId", "ScenarioName", "ScenarioType", "GameStartTime", "GameDuration",
  "FriendlyFireMode", "IRSensorMode", "BackgroundBrightness", "DamagedGlowColor", "RestoreCatridgesOnRespawn", "VampireMode",
  "TeamsCount", "DeathPoints", "FragPoints", "KillTeammatePoints", "HitPoints", "RevivePoints", "FlagSetPoints",
  "DeviceCapturedPoints", "DeviceDestroyPoints", "DeviceKeepingPoints", "GameFinishCondition",
  "TeamName", "TeamColor", "IsWinner", "TeamRatePoints", "TeamDeathsCount", "TeamFragsCount", "TeamTeammateKillsCount",
  "TeamHitsCount", "TeamRevivalsCount", "TeamDeviceCapturingsCount", "TeamTreatmentsCount",
  "PlayerName", "PlayerNickName", "PlayerPhoneNumber", "PlayerRole", "PlayerWeapons", "PlayerRatePoints", "PlayerDeathsCount",
  "PlayerFragsCount", "PlayerTeammateKillsCount", "PlayerHitsCount", "PlayerRevivalsCount", "PlayerDeviceCapturingsCount",
  "PlayerAccuracy", "PlayerShotsCount", "PlayerWoundsCount", "PlayerTreatmentsCount", "PlayerMaxFragSeries",
] as const;

const GAME_KEYS = LWA_CSV_HEADER.slice(0, 25); // through GameFinishCondition
// Team columns map "Team<Suffix>" -> team field; Name/Color are special-cased.
const TEAM_FIELDS: [string, string][] = [
  ["TeamRatePoints", "RatePoints"], ["TeamDeathsCount", "DeathsCount"], ["TeamFragsCount", "FragsCount"],
  ["TeamTeammateKillsCount", "TeammateKillsCount"], ["TeamHitsCount", "HitsCount"], ["TeamRevivalsCount", "RevivalsCount"],
  ["TeamDeviceCapturingsCount", "DeviceCapturingsCount"], ["TeamTreatmentsCount", "TreatmentsCount"],
];
const s = (v: unknown): string => (v == null ? "" : String(v));
const csvCell = (v: string): string => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

const stripBom = (t: string): string => t.replace(/^﻿/, "");

export function parseLwa(text: string): LwaGame {
  return JSON.parse(stripBom(text)) as LwaGame;
}

export function isLwa(text: string): boolean {
  const t = stripBom(text).trimStart();
  if (!t.startsWith("{")) return false;
  try {
    const o = JSON.parse(t) as LwaGame;
    return Array.isArray(o.Teams);
  } catch {
    return false;
  }
}

/** Flatten a parsed LWA game to CSV rows (one per player) + header. */
export function lwaToCsv(text: string): string {
  const g = parseLwa(text);
  const gameCells = (GAME_KEYS as readonly string[]).map((k) => s(g[k]));
  const lines: string[] = [LWA_CSV_HEADER.join(",")];
  for (const team of g.Teams ?? []) {
    const teamCells = [s(team.Name), s(team.Color), s(team.IsWinner), ...TEAM_FIELDS.map(([, f]) => s(team[f]))];
    for (const p of team.Players ?? []) {
      const weapon = (p.Weapons ?? []).map((w) => w?.Type ?? "").filter(Boolean).join(";");
      // PlayerWeapons sits between PlayerRole and PlayerRatePoints in the header.
      const row = [...gameCells, ...teamCells, s(p.Name), s(p.NickName), s(p.PhoneNumber), s(p.Role), weapon,
        s(p.RatePoints), s(p.DeathsCount), s(p.FragsCount), s(p.TeammateKillsCount), s(p.HitsCount), s(p.RevivalsCount),
        s(p.DeviceCapturingsCount), s(p.Accuracy), s(p.ShotsCount), s(p.WoundsCount), s(p.TreatmentsCount), s(p.MaxFragSeries)];
      lines.push(row.map(csvCell).join(","));
    }
  }
  return lines.join("\r\n") + "\r\n";
}

export type LwaPlayerStat = {
  headband: string; team: string;
  frags: number; deaths: number; hits: number; shots: number; wounds: number; revivals: number;
};

/** Per-player MATCH aggregate from an offline .lwa (one file = the whole match).
 *  Offline exports carry the killing portion only; captures/MaxFragSeries/gun are
 *  blank, so those are not read here. Team is the LWA team Color. */
export function lwaMatchPlayers(text: string): LwaPlayerStat[] {
  const g = parseLwa(text);
  const n = (v: unknown) => parseInt(s(v)) || 0;
  const out: LwaPlayerStat[] = [];
  for (const team of g.Teams ?? []) {
    const colour = s(team.Color).trim();
    for (const p of team.Players ?? []) {
      const hb = s(p.NickName).trim();
      if (!hb) continue;
      out.push({
        headband: hb, team: colour,
        frags: n(p.FragsCount), deaths: n(p.DeathsCount), hits: n(p.HitsCount),
        shots: n(p.ShotsCount), wounds: n(p.WoundsCount), revivals: n(p.RevivalsCount),
      });
    }
  }
  return out;
}

/** Per-player counters from an LWA file, keyed by nickname (for cross-check). */
export function lwaPlayerCounters(text: string): Record<string, Record<string, number>> {
  const g = parseLwa(text);
  const out: Record<string, Record<string, number>> = {};
  const n = (v: unknown) => parseInt(s(v)) || 0;
  for (const team of g.Teams ?? []) {
    for (const p of team.Players ?? []) {
      const nick = s(p.NickName).trim();
      if (!nick) continue;
      out[nick] = {
        frags: n(p.FragsCount), deaths: n(p.DeathsCount), hits: n(p.HitsCount), shots: n(p.ShotsCount),
        wounds: n(p.WoundsCount), captures: n(p.DeviceCapturingsCount), revivals: n(p.RevivalsCount),
      };
    }
  }
  return out;
}
