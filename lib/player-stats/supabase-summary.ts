/**
 * lib/player-stats/supabase-summary.ts
 * --------------------------------------------------------------------
 * Supabase-backed data source for the Player Summary. Produces the SAME
 * PlayerStatsRaw (Record<string,string>) shape the Sheets version does, so
 * the existing summary projections + components render it unchanged (and the
 * Sheets-based Compare page stays untouched).
 *
 * Stats are PER-MATCH (total ÷ games), matching the current live site.
 * Ratings are numeric stars from player_ratings, encoded into synthetic
 * "_N_Star" image strings so RatingPill's star-from-filename logic works
 * without any component change (unrated -> empty string -> no pill).
 *
 * Everything reads from the public-read read-models + config tables.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerStatsRaw } from "@/lib/player-stats/shared";
import { DEFAULT_AVATAR_URL } from "@/lib/avatar";
import { ACCOLADES } from "@/lib/player-stats/summary-accolades";

/** Encode a star count into a synthetic string RatingPill can parse (_N_Star). */
function starImage(stars: number | null): string {
  return stars == null ? "" : `star_${Math.max(0, Math.min(5, stars))}_Star`;
}

function num(v: number | null | undefined): string {
  return v == null ? "" : String(v);
}

type LifetimeRow = {
  account_id: string;
  nickname: string | null;
  profile_pic_url: string | null;
  games: number | null;
  wins: number | null;
  win_rate: number | null;
  total_kills: number | null;
  total_damage: number | null;
  total_score: number | null;
  avg_accuracy: number | null;
  avg_kd: number | null;
  avg_match_rating: number | null;
  current_level: number | null;
  total_xp: number | null;
  rounds_won: number | null;
  rounds_lost: number | null;
};

export type SummaryRowResult = {
  row: PlayerStatsRaw;
  /** Whether the player has an actual rating (drives the unlock explainer). */
  ratingUnlocked: boolean;
};

/**
 * Build the synthetic summary row for one player, looked up by ops tag
 * (case-insensitive on the denormalized nickname). Returns null if the
 * player has no stats row (never played / unknown tag).
 */
export async function getPlayerSummaryRow(
  supabase: SupabaseClient,
  opsTag: string,
): Promise<SummaryRowResult | null> {
  const { data: life } = await supabase
    .from("player_stats_lifetime")
    .select(
      "account_id, nickname, profile_pic_url, games, wins, win_rate, total_kills, total_damage, total_score, avg_accuracy, avg_kd, avg_match_rating, current_level, total_xp, rounds_won, rounds_lost",
    )
    .ilike("nickname", opsTag)
    .maybeSingle<LifetimeRow>();

  if (!life) return null;

  const accountId = life.account_id;

  const [
    { data: rating },
    { data: favGuns },
    { data: awards },
    { data: accoladeDefs },
    { data: ranks },
    { data: allGuns },
  ] = await Promise.all([
    supabase
      .from("player_ratings")
      .select(
        "s_match_win, s_rounds_wl, s_kills, s_damage, s_score, s_accuracy, s_kd, s_match_rating, rating_overall",
      )
      .eq("account_id", accountId)
      .maybeSingle(),
    supabase
      .from("player_gun_stats")
      .select("gun_name, rounds, total_kills")
      .eq("account_id", accountId)
      .order("rounds", { ascending: false })
      .order("total_kills", { ascending: false })
      .limit(1),
    supabase.from("match_awards").select("accolade_definition_id").eq("account_id", accountId),
    supabase.from("accolade_definitions").select("id, name"),
    supabase.from("rank_levels").select("level, rank_name, badge_url, score_threshold").order("level"),
    supabase.from("guns").select("name, image_url"),
  ]);

  const games = life.games ?? 0;
  const perMatch = (total: number | null) => (games > 0 ? (total ?? 0) / games : 0);
  const hasRating = !!rating;

  // Rank + level progress from rank_levels (score_threshold = cumulative XP).
  const level = life.current_level ?? 0;
  const totalXp = life.total_xp ?? 0;
  const rankRows = (ranks ?? []) as { level: number; rank_name: string | null; badge_url: string | null; score_threshold: number | null }[];
  const thisRank = rankRows.find((r) => r.level === level);
  const nextRank = rankRows.find((r) => r.level === level + 1);
  const curThresh = thisRank?.score_threshold ?? 0;
  const nextThresh = nextRank?.score_threshold ?? null;
  const progressFraction =
    nextThresh != null && nextThresh > curThresh
      ? Math.max(0, Math.min(1, (totalXp - curThresh) / (nextThresh - curThresh)))
      : nextThresh == null
        ? 1
        : 0;

  // Favourite gun (most rounds, kills tiebreak) -> image from guns config.
  const favGun = (favGuns ?? [])[0]?.gun_name ?? "";
  const gunImage =
    ((allGuns ?? []) as { name: string; image_url: string | null }[]).find(
      (g) => g.name === favGun,
    )?.image_url ?? "";

  // Accolade counts: tally awards by definition id -> name -> catalog sheetCol.
  const idToName = new Map(
    ((accoladeDefs ?? []) as { id: string; name: string }[]).map((d) => [d.id, d.name]),
  );
  const countByName = new Map<string, number>();
  for (const a of (awards ?? []) as { accolade_definition_id: string }[]) {
    const name = idToName.get(a.accolade_definition_id);
    if (name) countByName.set(name, (countByName.get(name) ?? 0) + 1);
  }
  const accoladeColumns: Record<string, string> = {};
  for (const acc of ACCOLADES) {
    accoladeColumns[acc.sheetCol] = String(countByName.get(acc.name) ?? 0);
  }
  const accoladesTotal = (awards ?? []).length;

  const r = rating as
    | Record<"s_match_win" | "s_rounds_wl" | "s_kills" | "s_damage" | "s_score" | "s_accuracy" | "s_kd" | "s_match_rating" | "rating_overall", number | null>
    | null;

  const row: PlayerStatsRaw = {
    Player_Stats_Nickname: life.nickname ?? opsTag,
    Player_Stats_Profile_Pic: life.profile_pic_url || DEFAULT_AVATAR_URL,

    // Top / level
    Overall_Rating_Image: starImage(r?.rating_overall ?? null),
    XP_Current_Rank_Badge_URL: thisRank?.badge_url ?? "",
    XP_Current_Level_Display: level > 0 ? `Level ${level}` : "",
    XP_Current_Level: String(level),
    Matches_Played: num(games),
    XP_Total: num(totalXp),
    XP_Level_Progress_Pct: String(progressFraction),
    Favourite_Gun: favGun,
    Favourite_Gun_Image: gunImage,

    // Stat cards
    Matches_Won: num(life.wins),
    Match_Win_Rate: num(life.win_rate),
    Match_Win_Rating_image: starImage(r?.s_match_win ?? null),

    Rounds_Won_Total: num(life.rounds_won),
    Rounds_Lost_Total: num(life.rounds_lost),
    Rounds_WL_Rating_Image: starImage(r?.s_rounds_wl ?? null),

    Kills_Total: num(life.total_kills),
    Kills_Per_Match: String(perMatch(life.total_kills)),
    Kills_Per_Match_Rating_Image: starImage(r?.s_kills ?? null),

    Damage_Total: num(life.total_damage),
    Damage_Per_Match: String(perMatch(life.total_damage)),
    Damage_Rating_Image: starImage(r?.s_damage ?? null),

    Score_Total: num(life.total_score),
    Score_Per_Match: String(perMatch(life.total_score)),
    Score_Rating_Image: starImage(r?.s_score ?? null),

    Match_Rating: num(life.avg_match_rating),
    Match_Rating_Rating_Image: starImage(r?.s_match_rating ?? null),

    Accuracy: num(life.avg_accuracy),
    Accuracy_Rating_Image: starImage(r?.s_accuracy ?? null),

    KD_Ratio: num(life.avg_kd),
    KD_Rating_Image: starImage(r?.s_kd ?? null),

    // Accolades
    Accolades_Total: String(accoladesTotal),
    ...accoladeColumns,
  };

  return { row, ratingUnlocked: hasRating };
}

/** Distinct player nicknames for the search autocomplete. */
export async function listSupabaseNicknames(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase
    .from("player_stats_lifetime")
    .select("nickname")
    .order("nickname");
  const names = ((data ?? []) as { nickname: string | null }[])
    .map((r) => r.nickname?.trim() ?? "")
    .filter((n) => n !== "");
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
}
