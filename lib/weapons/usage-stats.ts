/**
 * lib/weapons/usage-stats.ts
 * --------------------------------------------------------------------
 * Walks every row of Game_Data_Lookup_Public and aggregates per-gun
 * stats for the weapons-page bubble chart.
 *
 * For each gun (keyed by LaserOps_Gun_Used), computes:
 *   - totalKills        — sum of PlayerFragsCount
 *   - totalDeaths       — sum of PlayerDeathsCount
 *   - totalShots        — sum of PlayerShotsCount
 *   - totalHits         — sum of (accuracy * shots) per row, rounded
 *   - matchCount        — number of player-match rows using the gun
 *   - avgKillsPerMatch  — totalKills / matchCount (drives bubble
 *                         size in the meta chart)
 *   - globalKD          — totalKills / totalDeaths (capped, see below)
 *   - globalAccuracy    — totalHits / totalShots, as a 0..1 fraction
 *
 * IMPORTANT — accuracy aggregation:
 *   Per-row PlayerAccuracy is a ratio (hits/shots) that already
 *   exists in the data. To compute a GLOBAL accuracy across many
 *   matches with that gun, we cannot just average the per-row
 *   accuracies — that gives equal weight to a 5-shot match and a
 *   500-shot match. Instead we sum the implied hits (accuracy *
 *   shots, rounded to integer) and divide by total shots. This is
 *   the same way Looker would compute it, and matches the player's
 *   intuitive "out of all my shots, what % hit?"
 *
 * Excludes:
 *   - Rows with no gun (LaserOps_Gun_Used is blank/missing)
 *   - The synthetic "Unknown" gun used as a fallback in the data
 *     (matches no real weapon — see the same filter applied in
 *     lib/cms/weapons.ts when populating the gallery).
 */

import { fetchGameDataRows, type GameDataRow } from "@/lib/game-data/lookup";
import { isFallbackGunName } from "@/lib/cms/weapons";
import { parseNumericOr } from "@/lib/sheets";

export type WeaponUsageStats = {
  gunName: string;
  /** URL of the gun's image, captured from LaserOps_Gun_Used_Image. */
  imageUrl: string;
  /** Tree branch this gun belongs to, looked up from the weapons CMS.
   *  Empty string when no match exists in the CMS (gun appears in
   *  game data but not yet in the weapons sheet — surfaces as a
   *  console-friendly "needs catalog entry" hint without breaking
   *  the chart). The chart's tree-filter dropdown skips entries with
   *  empty tree branches. */
  treeBranch: string;
  totalKills: number;
  totalDeaths: number;
  totalShots: number;
  totalHits: number;
  matchCount: number;
  /** Average kills per match using this gun. Drives the bubble size
   *  in the meta chart — a more honest "how lethal in a typical
   *  game" metric than raw total kills (which favours heavily-used
   *  guns regardless of their actual effectiveness).
   *
   *  Always finite because the aggregator only emits entries for
   *  guns with matchCount >= 1. */
  avgKillsPerMatch: number;
  globalKD: number;
  globalAccuracy: number;
};

/**
 * Fetch + aggregate. Returns one entry per gun observed in the data,
 * sorted by total kills descending (most-used guns first — useful
 * downstream for chart legends or fallback display orders).
 *
 * Only guns with at least one match are returned. Empty result if
 * the underlying fetch fails — same convention as the other CMS
 * fetchers, so callers can render an empty-state UI.
 *
 * `treeBranchByName` is an optional lookup the caller can pass in
 * to enrich each output entry with its tree branch. Typically built
 * at the page level after fetching the weapons CMS list:
 *
 *     const treeMap = new Map(weapons.map(w => [w.name, w.treeBranch]));
 *     const stats = await fetchWeaponUsageStats(treeMap);
 *
 * Lookup misses (a gun appearing in match data but not in the CMS
 * sheet) result in an empty `treeBranch` string — chart filters
 * skip those entries when a specific tree is selected.
 */
export async function fetchWeaponUsageStats(
  treeBranchByName?: ReadonlyMap<string, string>,
): Promise<WeaponUsageStats[]> {
  const result = await fetchGameDataRows();
  if (!result.ok) return [];

  // Accumulator keyed by gun name. Built up as we walk the rows
  // exactly once. O(n) — n = number of player-match rows in the
  // game data sheet (currently low thousands, well within budget).
  const acc = new Map<string, {
    name: string;
    imageUrl: string;
    kills: number;
    deaths: number;
    shots: number;
    hits: number;
    matches: number;
  }>();

  for (const row of result.rows) {
    accumulate(row, acc);
  }

  // Convert the Map values into the public shape with derived stats
  // (K/D, accuracy) computed once per gun rather than re-derived at
  // every render downstream.
  const out: WeaponUsageStats[] = [];
  for (const v of acc.values()) {
    out.push({
      gunName: v.name,
      imageUrl: v.imageUrl,
      treeBranch: treeBranchByName?.get(v.name) ?? "",
      totalKills: v.kills,
      totalDeaths: v.deaths,
      totalShots: v.shots,
      totalHits: v.hits,
      matchCount: v.matches,
      // matchCount guaranteed >= 1 here because we only insert into
      // `acc` when accumulating a real row (and every accumulated
      // row increments matches by 1).
      avgKillsPerMatch: v.kills / v.matches,
      globalKD: v.kills / Math.max(v.deaths, 1),
      globalAccuracy: v.hits / Math.max(v.shots, 1),
    });
  }

  out.sort((a, b) => b.totalKills - a.totalKills);
  return out;
}

/**
 * Per-row accumulation. Pulled into its own function to keep the
 * loop body in fetchWeaponUsageStats readable.
 *
 * Skips rows that don't contribute to any gun's stats:
 *   - Empty/missing gun name
 *   - "Unknown" placeholder rows
 *
 * For valid rows, increments the per-gun accumulator (creating it
 * lazily on first sighting). The image URL gets recorded once on
 * first sighting and never overwritten — assumes the same gun
 * always has the same image URL across matches, which is true in
 * the data model.
 */
function accumulate(
  row: GameDataRow,
  acc: Map<string, {
    name: string;
    imageUrl: string;
    kills: number;
    deaths: number;
    shots: number;
    hits: number;
    matches: number;
  }>,
): void {
  const gunName = (row.raw.LaserOps_Gun_Used ?? "").trim();
  if (gunName === "") return;
  // Drop fallback / placeholder gun names. Same filter applied in
  // lib/cms/weapons.ts so the gallery and the meta chart agree on
  // what counts as a "non-gun" row. Variants handled: "Unknown",
  // "None", "N/A", "No Gun", and casing/whitespace drift.
  if (isFallbackGunName(gunName)) return;

  const kills = parseNumericOr(row.raw.PlayerFragsCount, 0);
  const deaths = parseNumericOr(row.raw.PlayerDeathsCount, 0);
  const shots = parseNumericOr(row.raw.PlayerShotsCount, 0);
  const accuracy = parseNumericOr(row.raw.PlayerAccuracy, 0); // 0..1
  // Implied hits for this row = accuracy * shots, rounded. Stored
  // and summed so global accuracy can be recomputed correctly across
  // matches with very different shot counts.
  const hits = Math.round(accuracy * shots);

  let entry = acc.get(gunName);
  if (entry === undefined) {
    entry = {
      name: gunName,
      imageUrl: (row.raw.LaserOps_Gun_Used_Image ?? "").trim(),
      kills: 0,
      deaths: 0,
      shots: 0,
      hits: 0,
      matches: 0,
    };
    acc.set(gunName, entry);
  }

  entry.kills += kills;
  entry.deaths += deaths;
  entry.shots += shots;
  entry.hits += hits;
  entry.matches += 1;
}
