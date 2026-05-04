/**
 * lib/player-stats/shared.ts
 * --------------------------------------------------------------------
 * Shared types and fetcher for the Player_Stats_PUBLIC sheet.
 *
 * One row per player, ~80 columns including all stats, accolades, ratings,
 * XP/levels, and ELO. The sheet is the same one the XP/Levels leaderboard
 * uses (lib/leaderboards/xp-levels.ts uses the same URL, in fact) — but
 * the shape consumed by the player summary view is much wider.
 *
 * Pattern: keep the raw row as a Record<string, string> with the column
 * names as keys. Each consuming component picks the columns it needs
 * and parses them. This keeps the type narrow at use sites without
 * forcing an 80-property interface up here.
 */

import {
  fetchSheetAsObjects,
  type SheetFetchResult,
} from "@/lib/sheets";

/** Same URL used by the XP/Levels leaderboard — public, anyone can read. */
export const PLAYER_STATS_PUBLIC_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTTLlM4fIfh52DiovbJT2b9A6UyqoiQtoG0c2HoVRCG_OCtLPZvz-uBSC6y1voM8d4jBVCNcpCGctco/pub?gid=746018421&single=true&output=csv";

/** Fallback profile pic URL — same one Looker's calculated field uses. */
export const FALLBACK_PROFILE_PIC =
  "https://i.postimg.cc/sxy2jVMR/Generic-Ops-Profile-Pic.png";

/**
 * Raw shape of one row from the Player_Stats sheet. Index signature plus
 * minimal known keys — every consumer narrows to its own subset.
 */
export type PlayerStatsRaw = Record<string, string> & {
  Player_Stats_Nickname: string;
  Player_Stats_Profile_Pic: string;
};

/**
 * Fetch all player rows. Cached 5min via Next.js fetch revalidate.
 * Server-side only. Each consuming page calls this and slices the result.
 */
export async function fetchAllPlayerStats(): Promise<SheetFetchResult<PlayerStatsRaw>> {
  const result = await fetchSheetAsObjects<PlayerStatsRaw>(
    PLAYER_STATS_PUBLIC_CSV_URL,
  );
  if (!result.ok) return result;

  // Drop rows with no nickname (defensive against blank trailing rows in source).
  const filtered = result.rows.filter(
    (r) => r.Player_Stats_Nickname && r.Player_Stats_Nickname.trim() !== "",
  );

  if (filtered.length === 0) {
    return { ok: false, error: "Player stats sheet returned no usable rows." };
  }

  return { ok: true, rows: filtered };
}

/**
 * Look up a player by ops tag (case-insensitive). Returns undefined if no match.
 * Pure function — caller is expected to have already fetched all rows.
 */
export function findPlayerByOpsTag(
  rows: PlayerStatsRaw[],
  opsTag: string,
): PlayerStatsRaw | undefined {
  const needle = opsTag.trim().toLowerCase();
  if (needle === "") return undefined;
  return rows.find((r) => r.Player_Stats_Nickname.trim().toLowerCase() === needle);
}

/**
 * Return all nicknames sorted alphabetically — used to populate the search
 * autocomplete datalist.
 *
 * Deduplicated: two players in the data can share the same Ops Tag (e.g.
 * "Nick"), and the React <datalist> requires unique keys when iterating.
 * We collapse duplicates here at the source so every consumer (Summary
 * autocomplete, History autocomplete, future Armory) gets a clean list
 * without having to dedupe individually. Case-insensitive comparison —
 * "nick" and "Nick" collapse to a single entry, with the first
 * occurrence's casing winning.
 */
export function listAllNicknames(rows: PlayerStatsRaw[]): string[] {
  // Use a Map keyed by lowercased nickname so we can collapse
  // case-variant duplicates while preserving the original casing of
  // whichever appeared first in the source data.
  const seen = new Map<string, string>();
  for (const r of rows) {
    const trimmed = r.Player_Stats_Nickname.trim();
    if (trimmed === "") continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) seen.set(key, trimmed);
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}
