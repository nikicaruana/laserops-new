/* eslint-disable */
/**
 * scripts/online-backlog-config.ts
 * --------------------------------------------------------------------
 * Shared per-game config for RE-INGESTING the v2 backlog online games
 * (LO-2026-27..32) into the real pipeline (match_ingest_rounds + match_participants
 * -> publish). Copied verbatim from the frozen one-off `ingest-online-games.ts`,
 * which produced the current live DB. This is the forward source of truth for the
 * re-ingestion scripts (validate-reingest.ts, reingest-online-game.ts).
 *
 * NOTE on per-round identity swaps: `opsByHead` is MATCH-LEVEL. A headband worn by
 * two DIFFERENT people across rounds (e.g. Head 21 = A in R1-2, B in R3-5) is NOT
 * expressed here - it is captured separately as `identitySwaps` (mined from the
 * session notes + user-confirmed) and written to match_ingest_rounds.identity_overrides.
 */

export const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
export const hbNum = (n: string) => { const m = /head\s*0*(\d+)/i.exec(n || ""); return m ? Number(m[1]) : null; };

export type RoundMeta = { win: string | null; counts: boolean };
/** A per-round identity swap: for round index `round` (0-based), headband `headband`
 *  was worn by ops-tag `person` (overriding opsByHead for that round only). */
export type IdentitySwap = { round: number; headband: number; person: string };

export type GameCfg = {
  date: string;                          // played_on (ISO)
  opsByHead: Record<number, string>;     // headband -> ops tag (also merges match-level switches)
  roundMeta?: RoundMeta[];               // per JSON (file-sorted); default = all derived + counted
  gunOverride?: Record<string, string>;  // ops -> gun (when the LWA Type is ambiguous)
  onlineFiles?: { file: string; win: string | null }[]; // explicit online rounds (hybrid / when not all JSONs are real)
  offline?: { lwaFile: string; winners: (string | null)[] }; // HYBRID: the offline rounds' LWA + winners
  excludeHeadbands?: number[];           // drop these headbands before scoring
  identitySwaps?: IdentitySwap[];        // per-round "same headband, different person" (user-confirmed)
};

export const GAMES: Record<string, GameCfg> = {
  "27": {
    date: "2026-09-05",
    opsByHead: { 1: "Snaaaaaaake", 2: "Buwdha", 4: "Sina", 6: "Jens", 37: "BSoD", 39: "Jinnies", 40: "TheHolySpirit", 41: "Glenn", 42: "Tompa", 45: "aximus" },
  },
  "28": {
    date: "2026-09-08",
    opsByHead: {
      1: "Mustafa", 6: "JRilez", 39: "Uros", 40: "Glenn", 41: "Rowan", 45: "Niksu", 4: "POL",
      2: "Hasapardi", 47: "Hasapardi", 42: "Tompa", 51: "Tompa", 37: "Sina", 58: "Sina",
    },
    onlineFiles: [
      { file: "RealtimeStatistics_20260908_151300.json", win: "Blue" },
      { file: "RealtimeStatistics_20260908_153038.json", win: "Blue" },
    ],
    offline: { lwaFile: "AlphaTag.Statistic_2026.09.08_20.10.37.lwa", winners: ["Blue", "Blue", "Yellow"] },
    excludeHeadbands: [5],
    gunOverride: {
      POL: "AK-25 Predator", Mustafa: "AK-25 Predator", JRilez: "MG21 Berserk", Uros: "AK-25 Predator",
      Glenn: "AKM Legend", Rowan: "AK-25 Predator", Niksu: "AK-25 Predator", Hasapardi: "AR-15 Ranger",
      Tompa: "AK-25 Predator", Sina: "MP9LT Phoenix",
    },
  },
  "29": {
    date: "2026-09-12",
    opsByHead: { 1: "Sina", 2: "Mustafa", 6: "Tenmil Sokhet", 9: "Hasapardi", 26: "Wugy", 39: "ChrisKyle", 40: "Jens", 41: "Snaaaaaaake", 47: "BlueJay", 53: "PourHoneyOnMyBun" },
    roundMeta: [ { win: "Blue", counts: true }, { win: "Yellow", counts: true }, { win: "Yellow", counts: true }, { win: "Blue", counts: true }, { win: "Blue", counts: true } ],
    excludeHeadbands: [45],
  },
  "30": {
    date: "2026-09-19",
    opsByHead: { 1: "Uros", 4: "Agius89", 5: "Kuba", 6: "Kkkyle", 7: "Buwdha", 9: "OrteGaTD", 21: "Hasapardi", 23: "Jens", 26: "Sina", 27: "Glenn", 32: "ChrisKyle", 37: "_Stivala_", 39: "Kkkyle", 40: "Tompa", 41: "POL", 42: "Tenmil Sokhet", 43: "Waldemar", 44: "M1hoTD", 53: "Migz", 58: "TheHolySpirit" },
    roundMeta: [ { win: "Yellow", counts: true }, { win: "Blue", counts: true }, { win: "Yellow", counts: true }, { win: "Blue", counts: true }, { win: "Yellow", counts: true } ],
  },
  "31": {
    date: "2026-09-21",
    opsByHead: { 4: "Tompa", 21: "Hasapardi", 25: "Farru", 26: "Kini", 27: "Tenmil Sokhet", 51: "ChrisKyle", 7: "Mustafa", 32: "Glenn", 38: "Snaaaaaaake", 39: "PourHoneyOnMyBun", 42: "TheHolySpirit", 43: "Buwdha", 47: "Dre" },
    roundMeta: [ { win: "Yellow", counts: true }, { win: null, counts: false }, { win: "Blue", counts: true }, { win: "Blue", counts: true }, { win: "Yellow", counts: true }, { win: "Yellow", counts: true } ],
    gunOverride: { Glenn: "MG21 Berserk" },
  },
  "32": {
    date: "2026-09-26",
    opsByHead: { 1: "Seb PT", 4: "Chuck Joey", 5: "JRilez", 7: "Buwdha", 9: "Lupita", 12: "Boulton", 13: "Alejkilmister", 15: "Spooble", 20: "Snaaaaaaake", 21: "Umut", 25: "Alejkilmister", 26: "aximus", 27: "Stev-o", 32: "Glenn", 37: "PT", 38: "Tompa", 39: "Tenmil Sokhet", 40: "Piet", 41: "Dogukan", 42: "ChrisKyle", 43: "Huntress", 44: "LuXyz", 45: "Mustafa", 46: "Uros", 47: "Jens", 48: "M1hoTD", 49: "Hasapardi", 50: "Anna", 51: "Umut", 52: "TFG", 53: "Didi", 54: "Glenn", 55: "Dina", 56: "Dobi", 57: "Cinti", 59: "TheHolySpirit", 60: "Amy", 61: "LuXyz", 62: "OrteGaTD" },
    onlineFiles: [
      { file: "RealtimeStatistics_20260926_080541.json", win: "Blue" },
      { file: "RealtimeStatistics_20260926_083159.json", win: "Yellow" },
      { file: "RealtimeStatistics_20260926_090022.json", win: "Blue" },
    ],
    offline: { lwaFile: "AlphaTag.Statistic_2026.09.26_13.28.08_OfflineRounds.lwa", winners: ["Blue", "Yellow"] },
  },
};
