/**
 * lib/leaderboards/hall-of-fame-cached.ts
 * --------------------------------------------------------------------
 * Cached wrappers around the heavy, player-agnostic Hall of Fame + all-time
 * leaderboard aggregations. Each recomputes at most once per revalidate window
 * (Next Data Cache) and the result is shared across every request/player,
 * instead of re-querying + re-aggregating on every page load (Hall of Fame
 * page + Player Stats -> Achievements tab).
 *
 * These read only anon-readable public read-models, so they use a cookieless
 * public client (never opting the caller into dynamic rendering) and are safe to
 * cache globally. Invalidated on match publish via the "leaderboards" tag (and
 * the manual /api/revalidate "sheets" tag), plus a 30-min safety refresh.
 */
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { getWeaponsFromSupabase } from "@/lib/cms/supabase-weapons";
import {
  getHallOfFameChampions,
  getAllTimeRecords,
  getWeaponMasters,
  getAccoladeLeaders,
  getStreakLeaders,
} from "@/lib/leaderboards/supabase-hall-of-fame";
import { getPeriodRowsFromSupabase } from "@/lib/leaderboards/supabase-period";
import { getXpLevelsFromSupabase } from "@/lib/leaderboards/supabase-xp-levels";
import { getActiveSeason } from "@/lib/cms/seasons";
import {
  getSeasonsFromSupabase,
  getChallengesFromSupabase,
  getSeasonChallengeData,
} from "@/lib/leaderboards/supabase-challenges";

const REVALIDATE = 1800; // 30 minutes
const TAGS = ["leaderboards", "sheets"];
const opts = { revalidate: REVALIDATE, tags: TAGS };

export const getCachedHallOfFameChampions = unstable_cache(
  async () => getHallOfFameChampions(createPublicClient()),
  ["hof-champions-v1"],
  opts,
);

export const getCachedAllTimeRecords = unstable_cache(
  async () => getAllTimeRecords(createPublicClient()),
  ["hof-all-time-records-v1"],
  opts,
);

export const getCachedWeaponMasters = unstable_cache(
  async () => {
    const sb = createPublicClient();
    const weapons = await getWeaponsFromSupabase();
    return getWeaponMasters(sb, weapons);
  },
  ["hof-weapon-masters-v1"],
  opts,
);

export const getCachedAccoladeLeaders = unstable_cache(
  async () => getAccoladeLeaders(createPublicClient()),
  ["hof-accolade-leaders-v1"],
  opts,
);

export const getCachedStreakLeaders = unstable_cache(
  async () => getStreakLeaders(createPublicClient()),
  ["hof-streak-leaders-v1"],
  opts,
);

export const getCachedPeriodRows = unstable_cache(
  async () => getPeriodRowsFromSupabase(createPublicClient()),
  ["lb-period-rows-v1"],
  opts,
);

export const getCachedXpLevels = unstable_cache(
  async () => getXpLevelsFromSupabase(createPublicClient()),
  ["lb-xp-levels-v1"],
  opts,
);

export type CurrentSeasonChallengeLeaders = {
  seasonName: string;
  challenges: { name: string; metricLabel: string; top: { rank: number; nickname: string; formatted: string }[] }[];
};

function humanizeMetric(metric: string): string {
  return metric.replace(/^(Total_|Season_|Max_|LaserOps_|Player)/i, "").replace(/_/g, " ").trim();
}
function fmtNum(v: number): string {
  return Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(2);
}

/** Current (active) season challenge standings, top 10 per challenge. */
export const getCachedCurrentSeasonChallenges = unstable_cache(
  async (): Promise<CurrentSeasonChallengeLeaders | null> => {
    const sb = createPublicClient();
    const seasons = await getSeasonsFromSupabase(sb);
    const active = getActiveSeason(seasons);
    if (!active) return null;
    const challenges = await getChallengesFromSupabase(sb, active.number);
    if (challenges.length === 0) return null;
    const data = await getSeasonChallengeData(sb, active, challenges);
    return {
      seasonName: active.name,
      challenges: data
        .filter((cd) => cd.entries.length > 0)
        .map((cd) => ({
          name: cd.challenge.name,
          metricLabel: cd.challenge.sourceMode === "gun_threshold_count" ? "guns" : humanizeMetric(cd.challenge.metric),
          top: cd.entries.slice(0, 10).map((e) => ({ rank: e.rank, nickname: e.nickname, formatted: fmtNum(e.metricValue) })),
        })),
    };
  },
  ["lb-current-season-challenges-v1"],
  opts,
);
