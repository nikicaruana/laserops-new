/**
 * app/admin/rating-leaderboard/page.tsx
 * --------------------------------------------------------------------
 * Admin-only rating leaderboard: rated players ranked by the weighted overall
 * score (player_ratings.rating_raw), with the overall stars and each
 * criterion's 0-5 star score. Weights come from rating_config so the column
 * tooltips match the live formula (edit them under Ratings).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RatingLeaderboardTable, type Criterion, type RatingRow } from "@/components/admin/RatingLeaderboardTable";

export const metadata: Metadata = { title: "Rating Leaderboard" };
export const dynamic = "force-dynamic";

// player_ratings column → rating_config weight key, in the Ratings page order.
const CRITERIA: { key: string; label: string; weightKey: string }[] = [
  { key: "s_obj1", label: "Obj 1 (hold)", weightKey: "Objective_1_Rating" },
  { key: "s_obj2", label: "Obj 2 (caps)", weightKey: "Objective_2_Rating" },
  { key: "s_kd", label: "K/D", weightKey: "KD_Rating" },
  { key: "s_match_rating", label: "Match rating", weightKey: "Match_Rating_Rating" },
  { key: "s_accuracy", label: "Accuracy", weightKey: "Accuracy_Rating" },
  { key: "s_kills", label: "Kills/round", weightKey: "Kills_Per_Match_Rating" },
  { key: "s_damage", label: "Damage", weightKey: "Damage_Rating" },
  { key: "s_rounds_wl", label: "Rounds W/L", weightKey: "Rounds_WL_Rating" },
  { key: "s_match_win", label: "Match win", weightKey: "Match_Win_Rating" },
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

  const weights = new Map((cfg ?? []).map((r) => [r.key as string, Number(r.value)]));
  const criteria: Criterion[] = CRITERIA.map((c) => ({
    key: c.key,
    label: c.label,
    weight: weights.has(c.weightKey) ? weights.get(c.weightKey)! : null,
  }));

  const rows: RatingRow[] = ((ratings ?? []) as unknown as Record<string, unknown>[]).map((r, i) => ({
    accountId: r.account_id as string,
    rank: i + 1,
    opsTag: (r.nickname as string) || "Player",
    pic: (r.profile_pic_url as string) || null,
    overall: r.rating_overall == null ? null : Number(r.rating_overall),
    raw: r.rating_raw == null ? null : Number(r.rating_raw),
    scores: Object.fromEntries(CRITERIA.map((c) => [c.key, r[c.key] == null ? null : Number(r[c.key])])),
  }));

  return (
    <div>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Rating Leaderboard</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          All {rows.length} rated players, ranked by their weighted overall score. Each criterion shows the player&rsquo;s 0 to 5 star
          score against the rated pool. Click a column to re-sort, and hover the (i) for each criterion&rsquo;s weight. Weights and
          eligibility are set under{" "}
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
