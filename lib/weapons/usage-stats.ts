/**
 * lib/weapons/usage-stats.ts
 * --------------------------------------------------------------------
 * Aggregates per-gun stats for the /weapons meta bubble chart from the
 * player_gun_stats read-model (one row per player x gun). Summing kills,
 * deaths, hits, shots and ROUNDS across every player who used a gun gives
 * a global per-round view — bubble size is average kills per round, the
 * mode-fair lethality measure the ratings also use.
 *
 * Gun images + tree branches come from the weapons catalogue (passed in),
 * since player_gun_stats only carries the gun name. Fallback / placeholder
 * gun names ("Unknown Gun", etc.) are skipped, same as the gallery.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isFallbackGunName } from "@/lib/cms/weapons";

export type WeaponUsageStats = {
  gunName: string;
  imageUrl: string;
  treeBranch: string;
  totalKills: number;
  totalDeaths: number;
  totalShots: number;
  totalHits: number;
  /** Total games this gun was used in (across players). Drives the
   *  minimum-sample filter in the chart. */
  matchCount: number;
  /** Total rounds this gun was used in (across players). */
  roundCount: number;
  /** Average kills per round with this gun. Drives the bubble size —
   *  a mode-fair "how lethal in a typical round" measure. */
  avgKillsPerRound: number;
  globalKD: number;
  globalAccuracy: number;
};

type GunStatRow = {
  gun_name: string | null;
  games: number | null;
  rounds: number | null;
  total_kills: number | null;
  total_deaths: number | null;
  total_hits: number | null;
  total_shots: number | null;
};

/**
 * Fetch + aggregate. Returns one entry per gun observed in the gun-stats
 * read-model, sorted by total kills descending. Empty on fetch failure.
 * `treeBranchByName` / `imageByName` enrich each entry from the weapons
 * catalogue (the aggregator has only the gun name otherwise).
 */
export async function fetchWeaponUsageStats(
  supabase: SupabaseClient,
  treeBranchByName?: ReadonlyMap<string, string>,
  imageByName?: ReadonlyMap<string, string>,
): Promise<WeaponUsageStats[]> {
  const { data } = await supabase
    .from("player_gun_stats")
    .select("gun_name, games, rounds, total_kills, total_deaths, total_hits, total_shots");

  const acc = new Map<string, {
    kills: number; deaths: number; shots: number; hits: number; games: number; rounds: number;
  }>();

  for (const r of (data ?? []) as GunStatRow[]) {
    const gunName = (r.gun_name ?? "").trim();
    if (gunName === "" || isFallbackGunName(gunName)) continue;
    const e = acc.get(gunName) ?? { kills: 0, deaths: 0, shots: 0, hits: 0, games: 0, rounds: 0 };
    e.kills += r.total_kills ?? 0;
    e.deaths += r.total_deaths ?? 0;
    e.shots += r.total_shots ?? 0;
    e.hits += r.total_hits ?? 0;
    e.games += r.games ?? 0;
    e.rounds += r.rounds ?? 0;
    acc.set(gunName, e);
  }

  const out: WeaponUsageStats[] = [];
  for (const [gunName, v] of acc.entries()) {
    out.push({
      gunName,
      imageUrl: imageByName?.get(gunName) ?? "",
      treeBranch: treeBranchByName?.get(gunName) ?? "",
      totalKills: v.kills,
      totalDeaths: v.deaths,
      totalShots: v.shots,
      totalHits: v.hits,
      matchCount: v.games,
      roundCount: v.rounds,
      avgKillsPerRound: v.rounds > 0 ? v.kills / v.rounds : 0,
      globalKD: v.kills / Math.max(v.deaths, 1),
      globalAccuracy: v.hits / Math.max(v.shots, 1),
    });
  }

  out.sort((a, b) => b.totalKills - a.totalKills);
  return out;
}
