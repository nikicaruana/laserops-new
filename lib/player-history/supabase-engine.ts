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
  matches: { match_code: string; played_on: string | null } | null;
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
        "frags,deaths,shots,damage,score,accuracy,kd,match_rating,match_average_score,score_performance_delta,gun_used,team_colour,was_winner,rounds_won,rounds_lost,elo_before,elo_after,elo_change,xp_total,level_after,nickname, matches!inner(match_code, played_on)",
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

/** Player's all-time best per tracked metric (earliest achievement wins ties). */
function computePersonalRecords(matches: PlayerMatch[]): PersonalRecord[] {
  const tracked: Array<{
    metric: PersonalRecord["metric"];
    label: string;
    extract: (m: PlayerMatch) => number;
    format: (v: number) => string;
  }> = [
    { metric: "score", label: "Score", extract: (m) => m.score, format: (v) => v.toLocaleString("en-US") },
    { metric: "matchRating", label: "Match Rating", extract: (m) => m.matchRating, format: (v) => v.toFixed(2) },
    { metric: "kills", label: "Kills", extract: (m) => m.kills, format: (v) => v.toString() },
    { metric: "kd", label: "K/D", extract: (m) => m.kd, format: (v) => v.toFixed(2) },
    { metric: "accuracy", label: "Accuracy", extract: (m) => m.accuracy, format: (v) => `${Math.round(v * 100)}%` },
    { metric: "damage", label: "Damage", extract: (m) => m.damage, format: (v) => v.toLocaleString("en-US") },
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
