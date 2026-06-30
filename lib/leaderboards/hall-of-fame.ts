/**
 * lib/leaderboards/hall-of-fame.ts
 * --------------------------------------------------------------------
 * Data engine for the Hall of Fame page. Three independent datasets:
 *
 *   1. Season Champions — reuses the seasonal-challenge engine for every
 *      COMPLETED season and keeps the top 2 finishers per challenge.
 *      (Champions = prize winners, so the existing admin/excluded-player
 *      exclusion in that engine is intentional and preserved.)
 *
 *   2. All-Time Records — single-game (one-off) bests across EVERY match
 *      row in Game_Data_Lookup. Includes everyone (no admin exclusion).
 *
 *   3. Weapon Masters — per gun: the career-score "master" (from the
 *      Player_Armory aggregate sheet) plus single-game gun records
 *      (computed from Game_Data_Lookup grouped by the gun used).
 */

import {
  fetchGameDataRows,
  readNumeric,
  type GameDataRow,
} from "@/lib/game-data/lookup";
import { fetchPlayerArmory } from "@/lib/cms/player-armory";
import { fetchWeapons } from "@/lib/cms/weapons";
import { fetchSeasons } from "@/lib/cms/seasons";
import { fetchChallenges } from "@/lib/cms/challenges";
import { fetchSeasonChallenges } from "@/lib/leaderboards/season-challenges";

/* ─── Types ─────────────────────────────────────────────────────────── */

/** One holder of a single-game record (or one row of a top-3 list). */
export type RecordEntry = {
  rank: number;
  nickname: string;
  profilePicUrl: string;
  value: number;
  formatted: string;
  /** Match the record was set in — links to the match report. May be "". */
  matchId: string;
};

/** A top-3 record list for one metric (e.g. "Highest Score"). */
export type RecordCategory = {
  key: string;
  label: string;
  /** Eligibility note, e.g. "Min. 20 kills in a game". */
  note?: string;
  entries: RecordEntry[];
};

export type WeaponMaster = {
  nickname: string;
  profilePicUrl: string;
  scoreTotal: number;
  formatted: string;
};

export type WeaponRecords = {
  weaponName: string;
  imageUrl: string;
  /** Highest total career score with this gun, or null if none. */
  master: WeaponMaster | null;
  /** Single-game records with this gun (score, kills, K/D, accuracy). */
  categories: RecordCategory[];
};

export type ChampionEntry = {
  rank: number;
  nickname: string;
  profilePicUrl: string;
  value: number;
  formatted: string;
};

export type SeasonChampionChallenge = {
  challengeNumber: number;
  name: string;
  description: string;
  /** Human label for the winning stat, derived from the challenge metric. */
  metricLabel: string;
  /** Top 2 finishers. */
  top: ChampionEntry[];
};

export type SeasonChampions = {
  seasonNumber: number;
  seasonName: string;
  challenges: SeasonChampionChallenge[];
};

/* ─── Formatters ────────────────────────────────────────────────────── */

const fmtInt = (v: number): string => Math.round(v).toLocaleString("en-US");
const fmtRatio = (v: number): string => v.toFixed(2);
const fmtPercent = (v: number): string => `${Math.round(v * 100)}%`;
/** For challenge metric values: integer unless it carries a fraction. */
const fmtNumber = (v: number): string =>
  Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(2);

/** Score column, falling back to PlayerRatePoints (mirrors player-history). */
function readScore(row: GameDataRow): number {
  const s = readNumeric(row, "LaserOps_Score", NaN);
  return Number.isFinite(s) ? s : readNumeric(row, "PlayerRatePoints", 0);
}

/* ─── Record specs (shared by all-time + per-weapon) ────────────────── */

type RecordSpec = {
  key: string;
  label: string;
  note?: string;
  value: (row: GameDataRow) => number;
  /** Eligibility gate (e.g. min kills / shots). */
  eligible?: (row: GameDataRow) => boolean;
  format: (v: number) => string;
};

const ALL_TIME_SPECS: RecordSpec[] = [
  { key: "score", label: "Highest Score", value: readScore, format: fmtInt },
  {
    key: "kills",
    label: "Most Kills",
    value: (r) => readNumeric(r, "PlayerFragsCount"),
    format: fmtInt,
  },
  {
    key: "kd",
    label: "Highest K/D",
    note: "Min. 20 kills in a game",
    value: (r) => readNumeric(r, "LaserOps_KD"),
    eligible: (r) => readNumeric(r, "PlayerFragsCount") > 20,
    format: fmtRatio,
  },
  {
    key: "accuracy",
    label: "Highest Accuracy",
    note: "Min. 250 shots in a game",
    value: (r) => readNumeric(r, "PlayerAccuracy"),
    eligible: (r) => readNumeric(r, "PlayerShotsCount") > 250,
    format: fmtPercent,
  },
  {
    key: "damage",
    label: "Most Damage",
    value: (r) => readNumeric(r, "LaserOps_Damage"),
    format: fmtInt,
  },
  {
    key: "rating",
    label: "Highest Match Rating",
    value: (r) => readNumeric(r, "LaserOps_Match_Rating"),
    format: fmtRatio,
  },
];

/** Single-game gun records — same metrics minus damage / rating. */
const WEAPON_SPECS: RecordSpec[] = [
  { key: "score", label: "Top Score", value: readScore, format: fmtInt },
  {
    key: "kills",
    label: "Most Kills",
    value: (r) => readNumeric(r, "PlayerFragsCount"),
    format: fmtInt,
  },
  {
    key: "kd",
    label: "Best K/D",
    note: "Min. 20 kills",
    value: (r) => readNumeric(r, "LaserOps_KD"),
    eligible: (r) => readNumeric(r, "PlayerFragsCount") > 20,
    format: fmtRatio,
  },
  {
    key: "accuracy",
    label: "Best Accuracy",
    note: "Min. 250 shots",
    value: (r) => readNumeric(r, "PlayerAccuracy"),
    eligible: (r) => readNumeric(r, "PlayerShotsCount") > 250,
    format: fmtPercent,
  },
];

/**
 * Rank rows by a spec, keep the top 3 (value > 0, eligibility applied).
 * One entry per player: rows are sorted best-first, so the first row seen
 * for a nickname is that player's best in this category — later rows for
 * the same player are dropped before taking the top 3.
 */
function topThree(rows: GameDataRow[], spec: RecordSpec): RecordEntry[] {
  const sorted = rows
    .filter((r) => (spec.eligible ? spec.eligible(r) : true))
    .map((r) => ({ row: r, v: spec.value(r) }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v);

  const seen = new Set<string>();
  const deduped = sorted.filter((x) => {
    const key = x.row.nickname.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.slice(0, 3).map((x, i) => ({
    rank: i + 1,
    nickname: x.row.nickname,
    profilePicUrl: x.row.profilePicUrl,
    value: x.v,
    formatted: spec.format(x.v),
    matchId: x.row.matchId,
  }));
}

/* ─── 2. All-Time Records ───────────────────────────────────────────── */

export async function fetchAllTimeRecords(): Promise<RecordCategory[]> {
  const result = await fetchGameDataRows();
  if (!result.ok) return [];
  return ALL_TIME_SPECS.map((spec) => ({
    key: spec.key,
    label: spec.label,
    note: spec.note,
    entries: topThree(result.rows, spec),
  }));
}

/* ─── 3. Weapon Masters ─────────────────────────────────────────────── */

export async function fetchWeaponMasters(): Promise<WeaponRecords[]> {
  const [gameResult, armoryRows, weapons] = await Promise.all([
    fetchGameDataRows(),
    fetchPlayerArmory(),
    fetchWeapons(),
  ]);

  const gameRows = gameResult.ok ? gameResult.rows : [];

  // Group every match row by the gun used (lowercased name).
  const rowsByGun = new Map<string, GameDataRow[]>();
  for (const r of gameRows) {
    const gun = (r.raw.LaserOps_Gun_Used ?? "").trim().toLowerCase();
    if (gun === "") continue;
    const arr = rowsByGun.get(gun);
    if (arr) arr.push(r);
    else rowsByGun.set(gun, [r]);
  }

  // Weapon master per gun = highest career Score_Total in the armory sheet.
  const masterByGun = new Map<string, WeaponMaster>();
  for (const a of armoryRows) {
    const gun = a.gunName.trim().toLowerCase();
    if (gun === "" || a.scoreTotal <= 0) continue;
    const existing = masterByGun.get(gun);
    if (!existing || a.scoreTotal > existing.scoreTotal) {
      masterByGun.set(gun, {
        nickname: a.playerNickname,
        profilePicUrl: a.playerProfilePic,
        scoreTotal: a.scoreTotal,
        formatted: fmtInt(a.scoreTotal),
      });
    }
  }

  const out: WeaponRecords[] = [];
  for (const w of [...weapons].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const key = w.name.trim().toLowerCase();
    const gunRows = rowsByGun.get(key) ?? [];
    const master = masterByGun.get(key) ?? null;
    const categories = WEAPON_SPECS.map((spec) => ({
      key: spec.key,
      label: spec.label,
      note: spec.note,
      entries: topThree(gunRows, spec),
    }));
    // Skip guns with no master and no records at all.
    const hasAny = master !== null || categories.some((c) => c.entries.length > 0);
    if (!hasAny) continue;
    out.push({ weaponName: w.name, imageUrl: w.imageUrl, master, categories });
  }
  return out;
}

/* ─── 1. Season Champions ───────────────────────────────────────────── */

/** Turn a raw metric column name into a short label, e.g. "Total_Kills" → "Kills". */
function humanizeMetric(metric: string): string {
  return metric
    .replace(/^(Total_|Season_|Max_|LaserOps_|Player)/i, "")
    .replace(/_/g, " ")
    .trim();
}

export async function fetchHallOfFameChampions(): Promise<SeasonChampions[]> {
  const seasons = await fetchSeasons();
  const completed = seasons
    .filter((s) => s.status === "completed")
    .sort((a, b) => b.number - a.number); // newest season first

  const out: SeasonChampions[] = [];
  for (const season of completed) {
    const challenges = await fetchChallenges(season.number);
    if (challenges.length === 0) continue;
    const data = await fetchSeasonChallenges(season, challenges);

    const champChallenges: SeasonChampionChallenge[] = data
      .filter((cd) => cd.entries.length > 0)
      .map((cd) => ({
        challengeNumber: cd.challenge.challengeNumber,
        name: cd.challenge.name,
        description: cd.challenge.description,
        metricLabel:
          cd.challenge.sourceMode === "gun_threshold_count"
            ? "guns"
            : humanizeMetric(cd.challenge.metric),
        top: cd.entries.slice(0, 2).map((e) => ({
          rank: e.rank,
          nickname: e.nickname,
          profilePicUrl: e.profilePicUrl,
          value: e.metricValue,
          formatted: fmtNumber(e.metricValue),
        })),
      }))
      .sort((a, b) => a.challengeNumber - b.challengeNumber);

    if (champChallenges.length > 0) {
      out.push({
        seasonNumber: season.number,
        seasonName: season.name,
        challenges: champChallenges,
      });
    }
  }
  return out;
}
