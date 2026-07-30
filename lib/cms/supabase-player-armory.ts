/**
 * lib/cms/supabase-player-armory.ts
 * --------------------------------------------------------------------
 * Supabase-backed player armory. Returns the existing PlayerArmoryRow[]
 * shape (from lib/cms/player-armory) for one player, read from the
 * player_armory read-model, so the Armory page + buildPlayerArmory render
 * unchanged. Weapon catalogue + excluded-player joins stay as-is.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerArmoryRow } from "@/lib/cms/player-armory";

const n = (v: number | null | undefined) => v ?? 0;
const s = (v: string | null | undefined) => v ?? "";
const b = (v: boolean | null | undefined) => v === true;

/** Unlock_Progress_Pct is stored as a 0-1 fraction; the card wants 0-100. */
function normalisePct(v: number | null | undefined): number {
  const x = v ?? 0;
  if (!Number.isFinite(x)) return 0;
  const asPct = x <= 1 ? x * 100 : x;
  return Math.max(0, Math.min(100, asPct));
}

type Row = Record<string, unknown>;

export async function getPlayerArmoryRows(
  supabase: SupabaseClient,
  opsTag: string,
): Promise<PlayerArmoryRow[]> {
  const { data } = await supabase
    .from("player_armory")
    .select("*")
    .ilike("nickname", opsTag.trim())
    .order("gun_sort_order");

  return ((data ?? []) as Row[]).map((r): PlayerArmoryRow => ({
    gunName: s(r.gun_name as string),
    playerNickname: s(r.nickname as string),
    playerProfilePic: s(r.profile_pic_url as string),
    playerRankBadge: s(r.rank_badge_url as string),
    playerLevel: n(r.player_level as number),
    gunClass: s(r.gun_class as string),
    treeBranch: s(r.tree_branch as string),
    gunUsedImg: s(r.gun_used_img as string),
    gunLockedImg: s(r.gun_locked_img as string),
    isDefault: b(r.is_default as boolean),
    sortOrder: n(r.gun_sort_order as number),
    gunDisplayTitle: s(r.gun_display_title as string),
    unlockType: s(r.unlock_type as string),
    unlockPrereqClass: s(r.unlock_prereq_class as string),
    unlockPrereqGun: s(r.unlock_prereq_gun as string),
    unlockReqPoints: n(r.unlock_req_points as number),
    unlockReqLevel: n(r.unlock_req_level as number),
    unlockDisplayText: s(r.unlock_display_text as string),
    gunIsUnlocked: b(r.gun_is_unlocked as boolean),
    gunPlayerStatus: s(r.gun_player_status as string),
    gunPlayerImage: s(r.gun_player_image as string),
    hasUsedGun: b(r.has_used_gun as boolean),
    pointsWithPrereqClass: n(r.points_with_prereq_class as number),
    pointsWithPrereqGun: n(r.points_with_prereq_gun as number),
    pointsTowardUnlock: n(r.points_toward_unlock as number),
    unlockProgressPct: normalisePct(r.unlock_progress_pct as number),
    unlockProgressRemaining: n(r.unlock_progress_remaining as number),
    unlockProgressText: s(r.unlock_progress_text as string),
    matchesUsed: n(r.matches_used as number),
    killsTotal: n(r.kills_total as number),
    avgKills: n(r.avg_kills as number),
    deathsTotal: n(r.deaths_total as number),
    hitsTotal: n(r.hits_total as number),
    shotsTotal: n(r.shots_total as number),
    damageTotal: n(r.damage_total as number),
    avgDamage: n(r.avg_damage as number),
    scoreTotal: n(r.score_total as number),
    avgScore: n(r.avg_score as number),
    avgAccuracy: n(r.avg_accuracy as number),
    kdRatio: n(r.kd_ratio as number),
    winsUsingGun: n(r.wins_using_gun as number),
    roundsWonUsingGun: n(r.rounds_won_using_gun as number),
    avgMatchRating: n(r.avg_match_rating as number),
    gunMagSize: n(r.gun_mag_size as number),
    gunDamage: n(r.gun_damage as number),
    gunReload: n(r.gun_reload as number),
    gunFireRate: s(r.gun_fire_rate as string),
  }));
}
