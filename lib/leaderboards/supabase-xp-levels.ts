/**
 * lib/leaderboards/supabase-xp-levels.ts
 * --------------------------------------------------------------------
 * Supabase-backed replacement for fetchXpLevelsLeaderboard(). Emits the
 * existing XpLevelsRow[] shape from player_stats_lifetime (one row per
 * account, pre-aggregated) joined to rank_levels for the current-level
 * rank badge, so the XP/Levels table renders unchanged.
 *
 * Sort: total_xp desc, tiebreak xp-per-round desc (total_xp / rounds).
 * Top 50, matching the sheet-era DISPLAY_LIMIT.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { XpLevelsRow } from "@/lib/leaderboards/xp-levels";
import { FALLBACK_PROFILE_PIC } from "@/lib/leaderboards/xp-levels";
import { isUnclaimedNickname } from "@/lib/leaderboards/unclaimed";

const DISPLAY_LIMIT = 50;

type LifetimeRow = {
  nickname: string | null;
  profile_pic_url: string | null;
  current_level: number | null;
  total_xp: number | null;
  games: number | null;
  rounds: number | null;
};

type RankRow = { level: number | null; badge_url: string | null };

export async function getXpLevelsFromSupabase(
  supabase: SupabaseClient,
): Promise<XpLevelsRow[]> {
  const [lifetimeRes, ranksRes] = await Promise.all([
    supabase
      .from("player_stats_lifetime")
      .select("nickname, profile_pic_url, current_level, total_xp, games, rounds"),
    supabase.from("rank_levels").select("level, badge_url"),
  ]);

  // level -> badge_url lookup for the current-rank badge.
  const badgeByLevel = new Map<number, string>();
  for (const r of (ranksRes.data ?? []) as RankRow[]) {
    if (r.level !== null && r.badge_url) badgeByLevel.set(r.level, r.badge_url);
  }

  const rows = ((lifetimeRes.data ?? []) as LifetimeRow[])
    .map((r) => {
      const nickname = (r.nickname ?? "").trim();
      const totalXp = r.total_xp ?? 0;
      const rounds = r.rounds ?? 0;
      const level = r.current_level ?? 0;
      return {
        nickname,
        profilePicUrl: (r.profile_pic_url ?? "").trim() || FALLBACK_PROFILE_PIC,
        rankBadgeUrl: badgeByLevel.get(level) ?? "",
        level,
        totalXp,
        xpPerRound: rounds > 0 ? totalXp / rounds : 0,
      };
    })
    .filter((r) => r.nickname !== "" && !isUnclaimedNickname(r.nickname))
    .sort((a, b) => {
      if (b.totalXp !== a.totalXp) return b.totalXp - a.totalXp;
      return b.xpPerRound - a.xpPerRound;
    })
    .slice(0, DISPLAY_LIMIT)
    .map((r, index): XpLevelsRow => ({ rank: index + 1, ...r }));

  return rows;
}
