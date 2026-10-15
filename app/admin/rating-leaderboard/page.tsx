/**
 * app/admin/rating-leaderboard/page.tsx
 * --------------------------------------------------------------------
 * Admin-only rating leaderboard: rated players ranked by the weighted overall
 * score (player_ratings.rating_raw). Each criterion shows the player's 0-5
 * rating (player_ratings.s_*) next to the stat it was ranked on, computed from
 * player_stats_lifetime exactly as refresh_player_ratings() does (K/D and
 * accuracy sum-based). Weights come from rating_config so the column tooltips
 * match the live formula (edit them under Ratings).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  RatingLeaderboardTable,
  type Criterion,
  type CriterionFormat,
  type RatingRow,
} from "@/components/admin/RatingLeaderboardTable";

export const metadata: Metadata = { title: "Rating Leaderboard" };
export const dynamic = "force-dynamic";

type Life = {
  account_id: string;
  win_rate: number | null;
  rounds_won: number | null;
  rounds_lost: number | null;
  kills_per_round: number | null;
  damage_per_round: number | null;
  total_hits: number | null;
  total_shots: number | null;
  total_kills: number | null;
  total_deaths: number | null;
  avg_match_rating: number | null;
  obj1_per_round: number | null;
  obj2_per_round: number | null;
};

const n = (v: unknown): number | null => (v == null ? null : Number(v));

// player_ratings star column → label, rated stat, display format, weight key.
// Order follows the Ratings page (heaviest weights first).
const CRITERIA: {
  key: string;
  label: string;
  tooltip: string;
  format: CriterionFormat;
  weightKey: string;
  value: (l: Life) => number | null;
}[] = [
  { key: "s_obj1", label: "Hold/R", tooltip: "Objective 1: hold time per online round (m:ss).", format: "mmss", weightKey: "Objective_1_Rating", value: (l) => n(l.obj1_per_round) },
  { key: "s_obj2", label: "Caps/R", tooltip: "Objective 2: captures per online round.", format: "dec2", weightKey: "Objective_2_Rating", value: (l) => n(l.obj2_per_round) },
  { key: "s_kd", label: "K/D", tooltip: "Total kills / total deaths.", format: "dec2", weightKey: "KD_Rating", value: (l) => (l.total_kills ?? 0) / Math.max(l.total_deaths ?? 0, 1) },
  { key: "s_match_rating", label: "Match Rtg", tooltip: "Average match rating.", format: "dec2", weightKey: "Match_Rating_Rating", value: (l) => n(l.avg_match_rating) },
  { key: "s_accuracy", label: "Acc", tooltip: "Accuracy: total hits / total shots.", format: "pct", weightKey: "Accuracy_Rating", value: (l) => ((l.total_shots ?? 0) > 0 ? (l.total_hits ?? 0) / (l.total_shots as number) : 0) },
  { key: "s_kills", label: "Kills/R", tooltip: "Kills per round.", format: "dec1", weightKey: "Kills_Per_Match_Rating", value: (l) => n(l.kills_per_round) },
  { key: "s_damage", label: "Dmg/R", tooltip: "Damage per round.", format: "int", weightKey: "Damage_Rating", value: (l) => n(l.damage_per_round) },
  {
    key: "s_rounds_wl",
    label: "Rnd W%",
    tooltip: "Rounds won / rounds played.",
    format: "pct",
    weightKey: "Rounds_WL_Rating",
    value: (l) => {
      const played = (l.rounds_won ?? 0) + (l.rounds_lost ?? 0);
      return played > 0 ? (l.rounds_won ?? 0) / played : null;
    },
  },
  { key: "s_match_win", label: "Match W%", tooltip: "Match win rate.", format: "pct", weightKey: "Match_Win_Rating", value: (l) => n(l.win_rate) },
];

export default async function RatingLeaderboardPage() {
  const supabase = await createClient();
  const [{ data: ratings }, { data: cfg }] = await Promise.all([
    supabase
      .from("player_ratings")
      .select(`account_id, nickname, profile_pic_url, rating_overall, rating_raw, ${CRITERIA.map((c) => c.key).join(", ")}`)
      .order("rating_raw", { ascending: false, nullsFirst: false }),
    supabase.from("rating_config").select("key, value"),
  ]);

  const ratingRows = (ratings ?? []) as unknown as Record<string, unknown>[];
  const ids = ratingRows.map((r) => r.account_id as string);
  const { data: lifeRows } = ids.length
    ? await supabase
        .from("player_stats_lifetime")
        .select("account_id, win_rate, rounds_won, rounds_lost, kills_per_round, damage_per_round, total_hits, total_shots, total_kills, total_deaths, avg_match_rating, obj1_per_round, obj2_per_round")
        .in("account_id", ids)
    : { data: [] };
  const lifeById = new Map(((lifeRows ?? []) as Life[]).map((l) => [l.account_id, l]));

  const weights = new Map((cfg ?? []).map((r) => [r.key as string, Number(r.value)]));
  const criteria: Criterion[] = CRITERIA.map((c) => ({
    key: c.key,
    label: c.label,
    tooltip: c.tooltip,
    format: c.format,
    weight: weights.has(c.weightKey) ? weights.get(c.weightKey)! : null,
  }));

  const rows: RatingRow[] = ratingRows.map((r, i) => {
    const life = lifeById.get(r.account_id as string);
    return {
      accountId: r.account_id as string,
      rank: i + 1,
      opsTag: (r.nickname as string) || "Player",
      pic: (r.profile_pic_url as string) || null,
      overall: n(r.rating_overall),
      raw: n(r.rating_raw),
      cells: Object.fromEntries(CRITERIA.map((c) => [c.key, { stars: n(r[c.key]), value: life ? c.value(life) : null }])),
    };
  });

  return (
    <div>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Rating Leaderboard</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          All {rows.length} rated players, ranked by their weighted overall score. Each criterion shows the player&rsquo;s stat
          next to their 0 to 5 rating against the rated pool. Click a column to sort by it, and hover the (i) for what it measures
          and its weight. Weights and eligibility are set under{" "}
          <Link href="/admin/ratings" className="font-semibold text-accent hover:underline">
            Ratings
          </Link>
          .
        </p>
      </header>
      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">No rated players yet (the eligible pool may be below the minimum).</p>
      ) : (
        <RatingLeaderboardTable rows={rows} criteria={criteria} />
      )}
    </div>
  );
}
