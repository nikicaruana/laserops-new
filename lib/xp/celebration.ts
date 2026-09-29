/**
 * lib/xp/celebration.ts
 * --------------------------------------------------------------------
 * First-login XP celebration: after a player's game(s) are scored, the next
 * time they open the portal they get an "in your face" XP + level-up + unlocks
 * animation. This computes the pending celebration (the XP journey across every
 * scored match they haven't seen yet) and records that they've seen it.
 *
 * Server-only: reads via the service client; a `player_xp_celebrated` row per
 * (account, match) marks a match as already celebrated.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { FALLBACK_PROFILE_PIC } from "@/lib/leaderboards/period-shared";

export type CelebrationUnlock = {
  level: number;
  title: string;
  description: string;
  iconUrl: string;
  rewardTokens: number;
  rewardDoubleXp: number;
  rewardXp15: number;
};

export type CelebrationLevel = { level: number; threshold: number; badgeUrl: string };

export type RewardImages = { token: string; doubleXp: string; xp15: string };

export type PendingCelebration = {
  nickname: string;
  profilePicUrl: string;
  gamesCount: number;
  startXp: number;
  endXp: number;
  startLevel: number;
  endLevel: number;
  leveledUp: boolean;
  /** startLevel .. endLevel+1, with XP thresholds + rank badges. */
  levels: CelebrationLevel[];
  /** Unlocks earned by crossing into new levels. */
  unlocks: CelebrationUnlock[];
  /** Reward artwork (game token coin + XP-boost tokens) for unlock rows. */
  rewardImages: RewardImages;
  /** Every match this celebration covers (marked seen on dismiss). */
  matchIds: string[];
};

type MpaRow = {
  match_id: string;
  xp_total_before_match: number | null;
  xp_total_after_match: number | null;
  level_before: number | null;
  level_after: number | null;
  matches: { played_on: string | null; sequence_no: number | null } | null;
};

export async function getPendingXpCelebration(
  svc: SupabaseClient,
  accountId: string,
  nickname: string,
  /** Preview: ignore the seen ledger so the full-history celebration always shows. */
  ignoreSeen = false,
): Promise<PendingCelebration | null> {
  const [{ data: celeb }, { data: mpa }] = await Promise.all([
    ignoreSeen
      ? Promise.resolve({ data: [] as { match_id: string }[] })
      : svc.from("player_xp_celebrated").select("match_id").eq("account_id", accountId),
    svc
      .from("match_player_aggregate")
      .select("match_id, xp_total_before_match, xp_total_after_match, level_before, level_after, matches!inner(played_on, sequence_no)")
      .eq("account_id", accountId),
  ]);

  const seen = new Set(((celeb ?? []) as { match_id: string }[]).map((r) => r.match_id));
  const rows = ((mpa ?? []) as unknown as MpaRow[])
    .filter((r) => !seen.has(r.match_id) && r.xp_total_after_match != null && r.xp_total_before_match != null)
    .sort(
      (a, b) =>
        (a.matches?.played_on ?? "").localeCompare(b.matches?.played_on ?? "") ||
        (a.matches?.sequence_no ?? 0) - (b.matches?.sequence_no ?? 0),
    );

  if (rows.length === 0) return null;

  const first = rows[0];
  const last = rows[rows.length - 1];
  const startXp = Number(first.xp_total_before_match) || 0;
  const endXp = Number(last.xp_total_after_match) || 0;
  const startLevel = Math.max(1, Number(first.level_before) || 1);
  const endLevel = Math.max(startLevel, Number(last.level_after) || startLevel);

  // Nothing actually gained -> no celebration (but leave the rows unseen; the
  // re-check is cheap and correct once real XP lands).
  if (endXp - startXp <= 0 && endLevel <= startLevel) return null;

  const [{ data: rl }, { data: ul }, { data: life }, { data: ri }] = await Promise.all([
    svc.from("rank_levels").select("level, score_threshold, badge_url").gte("level", startLevel).lte("level", endLevel + 1).order("level"),
    svc
      .from("level_unlocks")
      .select("level, title, description, icon_url, reward_tokens, reward_double_xp, reward_xp_1_5")
      .gt("level", startLevel)
      .lte("level", endLevel)
      .eq("is_active", true)
      .order("level"),
    svc.from("player_stats_lifetime").select("profile_pic_url").eq("account_id", accountId).maybeSingle(),
    svc.from("reward_images").select("key, image_url"),
  ]);

  const profilePicUrl = ((life as { profile_pic_url: string | null } | null)?.profile_pic_url ?? "").trim() || FALLBACK_PROFILE_PIC;
  const riMap = new Map(((ri ?? []) as { key: string; image_url: string | null }[]).map((r) => [r.key, (r.image_url ?? "").trim()]));
  const rewardImages: RewardImages = {
    token: riMap.get("game_token") ?? "",
    doubleXp: riMap.get("xp_boost_2x") ?? "",
    xp15: riMap.get("xp_boost_1_5x") ?? "",
  };

  const levels: CelebrationLevel[] = ((rl ?? []) as { level: number; score_threshold: number | null; badge_url: string | null }[]).map((r) => ({
    level: Number(r.level),
    threshold: Number(r.score_threshold) || 0,
    badgeUrl: (r.badge_url ?? "").trim(),
  }));

  const unlocks: CelebrationUnlock[] = ((ul ?? []) as {
    level: number;
    title: string | null;
    description: string | null;
    icon_url: string | null;
    reward_tokens: number | null;
    reward_double_xp: number | null;
    reward_xp_1_5: number | null;
  }[])
    .map((u) => ({
      level: Number(u.level),
      title: (u.title ?? "").trim(),
      description: (u.description ?? "").trim(),
      iconUrl: (u.icon_url ?? "").trim(),
      rewardTokens: Number(u.reward_tokens) || 0,
      rewardDoubleXp: Number(u.reward_double_xp) || 0,
      rewardXp15: Number(u.reward_xp_1_5) || 0,
    }))
    // Only show levels that actually have something configured.
    .filter((u) => u.title !== "" || u.description !== "" || u.rewardTokens > 0 || u.rewardDoubleXp > 0 || u.rewardXp15 > 0);

  return {
    nickname,
    profilePicUrl,
    gamesCount: rows.length,
    startXp,
    endXp,
    startLevel,
    endLevel,
    leveledUp: endLevel > startLevel,
    levels,
    unlocks,
    rewardImages,
    matchIds: rows.map((r) => r.match_id),
  };
}

export async function markCelebrated(svc: SupabaseClient, accountId: string, matchIds: string[]): Promise<void> {
  const ids = matchIds.filter((m) => typeof m === "string" && m.length > 0);
  if (ids.length === 0) return;
  await svc
    .from("player_xp_celebrated")
    .upsert(ids.map((match_id) => ({ account_id: accountId, match_id })), { onConflict: "account_id,match_id" });
}
