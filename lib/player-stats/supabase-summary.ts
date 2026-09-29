/**
 * lib/player-stats/supabase-summary.ts
 * --------------------------------------------------------------------
 * Supabase-backed data source for the Player Summary + Compare pages.
 * Produces the SAME PlayerStatsRaw (Record<string,string>) shape the Sheets
 * version does, so the existing projections + components render it unchanged.
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
import {
  ACCOLADES,
  buildAccoladesDataFromDefs,
  type AccoladesData,
  type AccoladeTier,
} from "@/lib/player-stats/summary-accolades";

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
  rounds: number | null;
  rounds_won: number | null;
  rounds_lost: number | null;
  online_games: number | null;
  online_rounds: number | null;
  total_captures: number | null;
  total_hold_seconds: number | null;
};

type RatingRow = Record<
  | "s_match_win"
  | "s_rounds_wl"
  | "s_kills"
  | "s_damage"
  | "s_accuracy"
  | "s_kd"
  | "s_match_rating"
  | "s_obj1"
  | "s_obj2"
  | "rating_overall",
  number | null
>;

type RankRow = { level: number; rank_name: string | null; badge_url: string | null; score_threshold: number | null };

const LIFETIME_COLS =
  "account_id, nickname, profile_pic_url, games, rounds, wins, win_rate, total_kills, total_damage, total_score, avg_accuracy, avg_kd, avg_match_rating, current_level, total_xp, rounds_won, rounds_lost, online_games, online_rounds, total_captures, total_hold_seconds";
const RATING_COLS =
  "s_match_win, s_rounds_wl, s_kills, s_damage, s_accuracy, s_kd, s_match_rating, s_obj1, s_obj2, rating_overall";
/** Which rating slot a game mode routes each objective stat into (default mode). */
type ObjSlots = { slot1: string | null; slot2: string | null };

/** Level progress fraction (0-1) from the rank_levels score_threshold ladder. */
function progressFor(ranks: RankRow[], level: number, totalXp: number): number {
  const cur = ranks.find((r) => r.level === level)?.score_threshold ?? 0;
  const next = ranks.find((r) => r.level === level + 1)?.score_threshold ?? null;
  if (next == null) return 1;
  if (next <= cur) return 0;
  return Math.max(0, Math.min(1, (totalXp - cur) / (next - cur)));
}

/** Assemble the synthetic PlayerStatsRaw row from a player's parts. */
function buildRow(args: {
  life: LifetimeRow;
  rating: RatingRow | null;
  favGun: string;
  gunImage: string;
  accoladeCounts: Map<string, number>;
  accoladesTotal: number;
  thisRank: RankRow | undefined;
  progressFraction: number;
  opsTagFallback: string;
  objSlots: ObjSlots;
}): PlayerStatsRaw {
  const { life, rating: r, favGun, gunImage, accoladeCounts, accoladesTotal, thisRank, progressFraction } = args;
  const games = life.games ?? 0;
  const perMatch = (total: number | null) => (games > 0 ? (total ?? 0) / games : 0);
  // Per-ROUND is the rated unit (the rating ranks kills/round, damage/round,
  // obj/round), so the cards show per-round to match their star.
  const rounds = life.rounds ?? 0;
  const perRound = (total: number | null) => (rounds > 0 ? (total ?? 0) / rounds : 0);
  // Objective stats are ONLINE-only, so their per-round uses online rounds.
  const onlineRounds = life.online_rounds ?? 0;
  const perOnlineRound = (total: number | null) => (onlineRounds > 0 ? (total ?? 0) / onlineRounds : 0);
  const level = life.current_level ?? 0;
  // Resolve the two generic objective stars onto the captures / hold cards via
  // the default mode's slot mapping (slot 1 = hold time, slot 2 = captures for
  // Domination). Falls back to null when a mode doesn't map that stat.
  const { slot1, slot2 } = args.objSlots;
  const capturesStar = slot1 === "captures" ? r?.s_obj1 ?? null : slot2 === "captures" ? r?.s_obj2 ?? null : null;
  const holdStar = slot1 === "hold_seconds" ? r?.s_obj1 ?? null : slot2 === "hold_seconds" ? r?.s_obj2 ?? null : null;

  const accoladeColumns: Record<string, string> = {};
  for (const acc of ACCOLADES) {
    accoladeColumns[acc.sheetCol] = String(accoladeCounts.get(acc.name) ?? 0);
  }

  return {
    Player_Stats_Nickname: life.nickname ?? args.opsTagFallback,
    Player_Stats_Profile_Pic: life.profile_pic_url || DEFAULT_AVATAR_URL,

    Overall_Rating_Image: starImage(r?.rating_overall ?? null),
    XP_Current_Rank_Badge_URL: thisRank?.badge_url ?? "",
    XP_Current_Level_Display: level > 0 ? `Level ${level}` : "",
    XP_Current_Level: String(level),
    Matches_Played: num(games),
    XP_Total: num(life.total_xp),
    XP_Level_Progress_Pct: String(progressFraction),
    Favourite_Gun: favGun,
    Favourite_Gun_Image: gunImage,

    Matches_Won: num(life.wins),
    Match_Win_Rate: num(life.win_rate),
    Match_Win_Rating_image: starImage(r?.s_match_win ?? null),

    Rounds_Won_Total: num(life.rounds_won),
    Rounds_Lost_Total: num(life.rounds_lost),
    Rounds_WL_Rating_Image: starImage(r?.s_rounds_wl ?? null),

    Kills_Total: num(life.total_kills),
    // NOTE: *_Per_Match keys now carry PER-ROUND values (labels say "/ Round").
    Kills_Per_Match: String(perRound(life.total_kills)),
    Kills_Per_Match_Rating_Image: starImage(r?.s_kills ?? null),

    Damage_Total: num(life.total_damage),
    Damage_Per_Match: String(perRound(life.total_damage)),
    Damage_Rating_Image: starImage(r?.s_damage ?? null),

    // Score's raw numbers stay for the Compare page; its rating star is retired
    // (Score is no longer a rating component — online/offline scores differ too
    // much to compare).
    Score_Total: num(life.total_score),
    Score_Per_Match: String(perMatch(life.total_score)),
    Score_Rating_Image: "",

    // Objective play (ONLINE games only).
    Captures_Total: num(life.total_captures),
    Captures_Per_Match: String(perOnlineRound(life.total_captures)),
    Captures_Rating_Image: starImage(capturesStar),

    Cap_Time_Total: num(life.total_hold_seconds),
    Cap_Time_Per_Match: String(perOnlineRound(life.total_hold_seconds)),
    Cap_Time_Rating_Image: starImage(holdStar),

    Match_Rating: num(life.avg_match_rating),
    Match_Rating_Rating_Image: starImage(r?.s_match_rating ?? null),

    Accuracy: num(life.avg_accuracy),
    Accuracy_Rating_Image: starImage(r?.s_accuracy ?? null),

    KD_Ratio: num(life.avg_kd),
    KD_Rating_Image: starImage(r?.s_kd ?? null),

    Accolades_Total: String(accoladesTotal),
    ...accoladeColumns,
  };
}

export type SummaryRowResult = {
  row: PlayerStatsRaw;
  /** Admin-driven accolades section data (accolade_definitions + counts). */
  accolades: AccoladesData;
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
    .select(LIFETIME_COLS)
    .ilike("nickname", opsTag)
    .maybeSingle<LifetimeRow>();

  if (!life) return null;

  const accountId = life.account_id;

  const [{ data: rating }, { data: favGuns }, { data: awards }, { data: accoladeDefs }, { data: ranks }, { data: allGuns }, { data: modeRow }] =
    await Promise.all([
      supabase.from("player_ratings").select(RATING_COLS).eq("account_id", accountId).maybeSingle(),
      supabase
        .from("player_gun_stats")
        .select("gun_name, rounds, total_kills")
        .eq("account_id", accountId)
        .order("rounds", { ascending: false })
        .order("total_kills", { ascending: false })
        .limit(1),
      supabase.from("match_awards").select("accolade_definition_id").eq("account_id", accountId),
      supabase.from("accolade_definitions").select("id, name, description, badge_url, xp"),
      supabase.from("rank_levels").select("level, rank_name, badge_url, score_threshold").order("level"),
      supabase.from("guns").select("name, image_url"),
      supabase.from("game_modes").select("obj_slot1_stat, obj_slot2_stat").eq("is_default", true).maybeSingle(),
    ]);

  const rankRows = (ranks ?? []) as RankRow[];
  const objSlots: ObjSlots = {
    slot1: (modeRow as { obj_slot1_stat: string | null } | null)?.obj_slot1_stat ?? null,
    slot2: (modeRow as { obj_slot2_stat: string | null } | null)?.obj_slot2_stat ?? null,
  };
  const level = life.current_level ?? 0;
  const favGun = (favGuns ?? [])[0]?.gun_name ?? "";
  const gunImage =
    ((allGuns ?? []) as { name: string; image_url: string | null }[]).find((g) => g.name === favGun)?.image_url ?? "";

  const idToName = new Map(((accoladeDefs ?? []) as { id: string; name: string }[]).map((d) => [d.id, d.name]));
  const accoladeCounts = new Map<string, number>();
  for (const a of (awards ?? []) as { accolade_definition_id: string }[]) {
    const name = idToName.get(a.accolade_definition_id);
    if (name) accoladeCounts.set(name, (accoladeCounts.get(name) ?? 0) + 1);
  }

  const accoladesData = buildAccoladesDataFromDefs(
    ((accoladeDefs ?? []) as { name: string | null; description: string | null; badge_url: string | null; xp: number | null }[])
      .filter((d) => !!d.name && (d.xp === 100 || d.xp === 75 || d.xp === 50))
      .map((d) => ({
        name: d.name as string,
        description: (d.description ?? "").trim(),
        badgeUrl: (d.badge_url ?? "").trim(),
        tier: d.xp as AccoladeTier,
      })),
    accoladeCounts,
    (awards ?? []).length,
  );

  const row = buildRow({
    life,
    rating: (rating as RatingRow | null) ?? null,
    favGun,
    gunImage,
    accoladeCounts,
    accoladesTotal: (awards ?? []).length,
    thisRank: rankRows.find((r) => r.level === level),
    progressFraction: progressFor(rankRows, level, life.total_xp ?? 0),
    opsTagFallback: opsTag,
    objSlots,
  });

  return { row, ratingUnlocked: !!rating, accolades: accoladesData };
}

/**
 * Build synthetic rows for ALL players + a distinct-guns-used map (keyed by
 * lowercased nickname). Powers the Compare page, which does its own
 * client-side two-player lookup over the full set (like the Sheets version).
 */
export async function getAllPlayerSummaryRows(
  supabase: SupabaseClient,
): Promise<{ rows: PlayerStatsRaw[]; uniqueGunsMap: Record<string, number> }> {
  const [{ data: lifeRows }, { data: ratingRows }, { data: gunRows }, { data: awardRows }, { data: accoladeDefs }, { data: ranks }, { data: allGuns }, { data: modeRow }] =
    await Promise.all([
      supabase.from("player_stats_lifetime").select(LIFETIME_COLS),
      supabase.from("player_ratings").select(`account_id, ${RATING_COLS}`),
      supabase.from("player_gun_stats").select("account_id, gun_name, rounds, total_kills"),
      supabase.from("match_awards").select("account_id, accolade_definition_id").not("account_id", "is", null),
      supabase.from("accolade_definitions").select("id, name"),
      supabase.from("rank_levels").select("level, rank_name, badge_url, score_threshold").order("level"),
      supabase.from("guns").select("name, image_url"),
      supabase.from("game_modes").select("obj_slot1_stat, obj_slot2_stat").eq("is_default", true).maybeSingle(),
    ]);

  const rankRows = (ranks ?? []) as RankRow[];
  const objSlots: ObjSlots = {
    slot1: (modeRow as { obj_slot1_stat: string | null } | null)?.obj_slot1_stat ?? null,
    slot2: (modeRow as { obj_slot2_stat: string | null } | null)?.obj_slot2_stat ?? null,
  };
  const gunImage = new Map(((allGuns ?? []) as { name: string; image_url: string | null }[]).map((g) => [g.name, g.image_url ?? ""]));
  const idToName = new Map(((accoladeDefs ?? []) as { id: string; name: string }[]).map((d) => [d.id, d.name]));

  const ratingByAccount = new Map<string, RatingRow>();
  for (const r of (ratingRows ?? []) as (RatingRow & { account_id: string })[]) {
    ratingByAccount.set(r.account_id, r);
  }

  // Per-account guns: favourite (most rounds, kills tiebreak) + distinct count.
  const gunsByAccount = new Map<string, { gun_name: string; rounds: number | null; total_kills: number | null }[]>();
  for (const g of (gunRows ?? []) as { account_id: string; gun_name: string; rounds: number | null; total_kills: number | null }[]) {
    const list = gunsByAccount.get(g.account_id) ?? [];
    list.push(g);
    gunsByAccount.set(g.account_id, list);
  }

  // Per-account accolade counts by name.
  const accoladesByAccount = new Map<string, Map<string, number>>();
  const accoladeTotalByAccount = new Map<string, number>();
  for (const a of (awardRows ?? []) as { account_id: string; accolade_definition_id: string }[]) {
    const name = idToName.get(a.accolade_definition_id);
    if (!name) continue;
    const m = accoladesByAccount.get(a.account_id) ?? new Map<string, number>();
    m.set(name, (m.get(name) ?? 0) + 1);
    accoladesByAccount.set(a.account_id, m);
    accoladeTotalByAccount.set(a.account_id, (accoladeTotalByAccount.get(a.account_id) ?? 0) + 1);
  }

  const rows: PlayerStatsRaw[] = [];
  const uniqueGunsMap: Record<string, number> = {};

  for (const life of (lifeRows ?? []) as LifetimeRow[]) {
    const acct = life.account_id;
    const gunList = (gunsByAccount.get(acct) ?? [])
      .slice()
      .sort((a, b) => (b.rounds ?? 0) - (a.rounds ?? 0) || (b.total_kills ?? 0) - (a.total_kills ?? 0));
    const favGun = gunList[0]?.gun_name ?? "";
    const level = life.current_level ?? 0;

    rows.push(
      buildRow({
        life,
        rating: ratingByAccount.get(acct) ?? null,
        favGun,
        gunImage: gunImage.get(favGun) ?? "",
        accoladeCounts: accoladesByAccount.get(acct) ?? new Map(),
        accoladesTotal: accoladeTotalByAccount.get(acct) ?? 0,
        thisRank: rankRows.find((r) => r.level === level),
        progressFraction: progressFor(rankRows, level, life.total_xp ?? 0),
        opsTagFallback: life.nickname ?? "",
        objSlots,
      }),
    );

    const nick = (life.nickname ?? "").trim().toLowerCase();
    if (nick) uniqueGunsMap[nick] = gunList.length;
  }

  return { rows, uniqueGunsMap };
}

/** Distinct player nicknames for the search autocomplete. */
export async function listSupabaseNicknames(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase.from("player_stats_lifetime").select("nickname").order("nickname");
  const names = ((data ?? []) as { nickname: string | null }[])
    .map((r) => r.nickname?.trim() ?? "")
    .filter((n) => n !== "");
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
}
