/**
 * lib/player-history/supabase-engine.ts
 * --------------------------------------------------------------------
 * Supabase-backed player history. Returns the SAME PlayerHistory shape as
 * the Sheets engine (lib/player-history/engine.ts), built from
 * match_player_aggregate joined to matches (+ guns / rank_levels config),
 * so the History page + view render unchanged. One row per player per match.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PlayerMatch,
  PersonalRecord,
  PlayerHistoryResult,
} from "@/lib/player-history/engine";
import { DEFAULT_AVATAR_URL } from "@/lib/avatar";

type AggRow = {
  frags: number | null;
  deaths: number | null;
  shots: number | null;
  damage: number | null;
  score: number | null;
  accuracy: number | null;
  kd: number | null;
  match_rating: number | null;
  match_average_score: number | null;
  score_performance_delta: number | null;
  gun_used: string | null;
  team_colour: string | null;
  was_winner: boolean | null;
  rounds_won: number | null;
  rounds_lost: number | null;
  elo_before: number | null;
  elo_after: number | null;
  elo_change: number | null;
  xp_total: number | null;
  level_after: number | null;
  nickname: string | null;
  captures: number | null;
  hold_seconds: number | null;
  matches: { match_code: string; played_on: string | null; online_round_count: number | null } | null;
};

const n = (v: number | null | undefined) => v ?? 0;

export async function getPlayerHistory(
  supabase: SupabaseClient,
  opsTag: string,
): Promise<PlayerHistoryResult> {
  const needle = opsTag.trim();
  if (needle === "") return { ok: false, reason: "player-not-found" };

  // Resolve the account by current ops tag, plus its current avatar.
  const { data: life } = await supabase
    .from("player_stats_lifetime")
    .select("account_id, profile_pic_url")
    .ilike("nickname", needle)
    .maybeSingle<{ account_id: string; profile_pic_url: string | null }>();

  if (!life) return { ok: false, reason: "player-not-found" };

  const [{ data: aggs }, { data: guns }, { data: ranks }] = await Promise.all([
    supabase
      .from("match_player_aggregate")
      .select(
        "frags,deaths,shots,damage,score,accuracy,kd,match_rating,match_average_score,score_performance_delta,gun_used,team_colour,was_winner,rounds_won,rounds_lost,elo_before,elo_after,elo_change,xp_total,level_after,nickname,captures,hold_seconds, matches!inner(match_code, played_on, online_round_count)",
      )
      .eq("account_id", life.account_id),
    supabase.from("guns").select("name, image_url"),
    supabase.from("rank_levels").select("level, rank_name, badge_url"),
  ]);

  const rows = (aggs ?? []) as unknown as AggRow[];
  if (rows.length === 0) return { ok: false, reason: "player-not-found" };

  const gunImage = new Map(
    ((guns ?? []) as { name: string; image_url: string | null }[]).map((g) => [
      g.name,
      g.image_url ?? "",
    ]),
  );
  const rankByLevel = new Map(
    ((ranks ?? []) as { level: number; rank_name: string | null; badge_url: string | null }[]).map(
      (r) => [r.level, r],
    ),
  );

  const profilePicUrl = life.profile_pic_url || DEFAULT_AVATAR_URL;

  const matches: PlayerMatch[] = rows.map((r) => {
    const playedOn = r.matches?.played_on ?? "";
    return {
      matchId: r.matches?.match_code ?? "",
      date: playedOn,
      yearMonth: playedOn ? playedOn.slice(0, 7) : "",
      nickname: r.nickname ?? needle,
      profilePicUrl,
      score: n(r.score),
      matchRating: n(r.match_rating),
      averageMatchScore: n(r.match_average_score),
      scorePerformanceDelta: n(r.score_performance_delta),
      kills: n(r.frags),
      deaths: n(r.deaths),
      kd: n(r.kd),
      accuracy: n(r.accuracy),
      shots: n(r.shots),
      damage: n(r.damage),
      gunUsed: r.gun_used ?? "",
      gunUsedImage: r.gun_used ? gunImage.get(r.gun_used) ?? "" : "",
      teamColor: r.team_colour ?? "",
      isWinner: r.was_winner === true,
      roundsWon: n(r.rounds_won),
      roundsLost: n(r.rounds_lost),
      eloBefore: n(r.elo_before),
      eloAfter: n(r.elo_after),
      eloChange: n(r.elo_change),
      xpEarned: n(r.xp_total),
      level: n(r.level_after),
      // Objective stats only apply to matches with online rounds; offline-only
      // games leave them undefined so the table shows a dash, not a false 0.
      ...((r.matches?.online_round_count ?? 0) > 0 ? { objCaps: n(r.captures), capTime: n(r.hold_seconds) } : {}),
    };
  });

  // Oldest first (chart series render left-to-right over time).
  matches.sort((a, b) => a.matchId.localeCompare(b.matchId, "en", { numeric: true }));

  const records = computePersonalRecords(matches);
  const mostRecent = matches[matches.length - 1];
  const currentRank = rankByLevel.get(mostRecent.level);

  return {
    ok: true,
    history: {
      matches,
      records,
      currentRankBadgeUrl: currentRank?.badge_url ?? "",
      currentRankName: currentRank?.rank_name ?? "",
      currentLevel: mostRecent.level,
      profilePicUrl,
    },
  };
}

type RecAggRow = {
  score: number | null;
  match_rating: number | null;
  frags: number | null;
  kd: number | null;
  accuracy: number | null;
  damage: number | null;
  captures: number | null;
  hold_seconds: number | null;
  matches: { match_code: string; online_round_count: number | null } | null;
};

/**
 * Single-match personal records for one player, by ops tag. Lightweight version
 * of getPlayerHistory used by the Compare page - only the columns the records
 * need, no guns/ranks joins. Returns [] when the player has no data.
 */
export async function getPlayerRecords(
  supabase: SupabaseClient,
  opsTag: string,
): Promise<PersonalRecord[]> {
  const needle = opsTag.trim();
  if (needle === "") return [];

  const { data: life } = await supabase
    .from("player_stats_lifetime")
    .select("account_id")
    .ilike("nickname", needle)
    .maybeSingle<{ account_id: string }>();
  if (!life) return [];

  const { data: aggs } = await supabase
    .from("match_player_aggregate")
    .select(
      "score,match_rating,frags,kd,accuracy,damage,captures,hold_seconds, matches!inner(match_code, online_round_count)",
    )
    .eq("account_id", life.account_id);

  const rows = (aggs ?? []) as unknown as RecAggRow[];
  if (rows.length === 0) return [];

  const matches: RecordInput[] = rows.map((r) => ({
    matchId: r.matches?.match_code ?? "",
    score: n(r.score),
    matchRating: n(r.match_rating),
    kills: n(r.frags),
    kd: n(r.kd),
    accuracy: n(r.accuracy),
    damage: n(r.damage),
    // Objective records only count for online matches (offline games have none).
    ...((r.matches?.online_round_count ?? 0) > 0 ? { objCaps: n(r.captures), capTime: n(r.hold_seconds) } : {}),
  }));

  return computePersonalRecords(matches);
}

/** Format a hold time in whole seconds as mm:ss (e.g. 95 -> "1:35"). */
function formatHoldTime(seconds: number): string {
  const sec = Math.max(0, Math.round(seconds));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/** Player's all-time best per tracked metric (earliest achievement wins ties). */
type RecordInput = Pick<
  PlayerMatch,
  "matchId" | "score" | "matchRating" | "kills" | "kd" | "accuracy" | "damage" | "objCaps" | "capTime"
>;

function computePersonalRecords(matches: RecordInput[]): PersonalRecord[] {
  const tracked: Array<{
    metric: PersonalRecord["metric"];
    label: string;
    extract: (m: RecordInput) => number;
    format: (v: number) => string;
  }> = [
    { metric: "score", label: "Score", extract: (m) => m.score, format: (v) => v.toLocaleString("en-US") },
    { metric: "matchRating", label: "Match Rating", extract: (m) => m.matchRating, format: (v) => v.toFixed(2) },
    { metric: "kills", label: "Kills", extract: (m) => m.kills, format: (v) => v.toString() },
    { metric: "kd", label: "K/D", extract: (m) => m.kd, format: (v) => v.toFixed(2) },
    { metric: "accuracy", label: "Accuracy", extract: (m) => m.accuracy, format: (v) => `${Math.round(v * 100)}%` },
    { metric: "damage", label: "Damage", extract: (m) => m.damage, format: (v) => v.toLocaleString("en-US") },
    { metric: "caps", label: "Caps", extract: (m) => m.objCaps ?? 0, format: (v) => v.toLocaleString("en-US") },
    { metric: "capTime", label: "Cap Time", extract: (m) => m.capTime ?? 0, format: formatHoldTime },
  ];

  return tracked.map((t) => {
    let best = -Infinity;
    let bestMatchId = "";
    for (const m of matches) {
      const v = t.extract(m);
      if (v > best) {
        best = v;
        bestMatchId = m.matchId;
      }
    }
    if (!Number.isFinite(best)) best = 0;
    return { metric: t.metric, label: t.label, value: best, formatted: t.format(best), matchId: bestMatchId };
  });
}
