/**
 * app/admin/levels/page.tsx
 * --------------------------------------------------------------------
 * The merged Levels page: the rank ladder and its per-level unlock rewards on
 * one screen. Rank names and score thresholds are formula-driven and owned by
 * the Progression calibrator (/admin/progression) — shown read-only here.
 * "Est. games" is derived live from the instated formula: it divides each
 * threshold by the average XP a player earns per game under the current
 * xp_config (computed from every real match row), so it always matches the
 * curve. This page owns each level's badge and unlock reward. Win-XP bonuses
 * moved to the calibrator, which is now the single source of the XP formula.
 */
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { LevelsManager, type LevelRow } from "@/components/admin/LevelsManager";
import { computeMatchXp, parseXpConfig } from "@/lib/scoring/xp";

export const metadata: Metadata = { title: "Levels" };

type AvgAgg = { match_id: string; score: number | null; rounds_won: number | null; was_winner: boolean | null; xp_from_accolades: number | null };

/** Average new-XP-per-game at multiplier 1 (a typical game, no boosts). */
function averageXpPerGame(agg: AvgAgg[], cfg: ReturnType<typeof parseXpConfig>): number {
  if (!agg.length) return 0;
  const byMatch: Record<string, number[]> = {};
  for (const r of agg) (byMatch[r.match_id] ??= []).push(r.score ?? 0);
  const avgScore: Record<string, number> = {};
  for (const [m, s] of Object.entries(byMatch)) avgScore[m] = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;

  let sum = 0;
  for (const r of agg) {
    const avg = avgScore[r.match_id] ?? 0;
    const rating = avg > 0 ? (r.score ?? 0) / avg : 0;
    sum += computeMatchXp(
      { rating, roundsWon: r.rounds_won ?? 0, isWinner: !!r.was_winner, accoladeXp: r.xp_from_accolades ?? 0, multiplier: 1 },
      cfg,
    ).xpTotal;
  }
  return sum / agg.length;
}

export default async function AdminLevelsPage() {
  const supabase = await createClient();
  const [{ data: levels }, { data: unlocks }, { data: xpCfgRows }, { data: aggRows }] = await Promise.all([
    supabase
      .from("rank_levels")
      .select("id, level, rank_name, score_threshold, badge_url")
      .order("level"),
    supabase
      .from("level_unlocks")
      .select("level, title, description, icon_url, reward_tokens, reward_double_xp, reward_xp_1_5, is_active"),
    supabase.from("xp_config").select("key, value"),
    supabase.from("match_player_aggregate").select("match_id, score, rounds_won, was_winner, xp_from_accolades"),
  ]);

  const xpCfg = parseXpConfig((xpCfgRows ?? []) as { key: string; value: number | null }[]);
  const avgXpPerGame = averageXpPerGame((aggRows ?? []) as AvgAgg[], xpCfg);

  const unlockByLevel = new Map<number, NonNullable<typeof unlocks>[number]>();
  for (const u of unlocks ?? []) unlockByLevel.set(u.level, u);

  const rows: LevelRow[] = (levels ?? []).map((l) => {
    const u = unlockByLevel.get(l.level);
    return {
      id: String(l.id),
      level: l.level,
      rankName: l.rank_name ?? "",
      threshold: Number(l.score_threshold ?? 0),
      badgeUrl: l.badge_url ?? "",
      title: u?.title ?? "",
      description: u?.description ?? "",
      iconUrl: u?.icon_url ?? "",
      rewardTokens: Number(u?.reward_tokens ?? 0),
      rewardDoubleXp: Number(u?.reward_double_xp ?? 0),
      rewardXp15: Number(u?.reward_xp_1_5 ?? 0),
      isActive: u?.is_active ?? true,
    };
  });

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Levels</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-muted">
            The rank ladder and the reward earned at each level. Rank names, XP thresholds and est. games are set by the{" "}
            <Link href="/admin/progression" className="text-accent hover:underline">
              Progression calibrator
            </Link>{" "}
            and shown read-only here. Expand a level to set its badge and unlock reward.
          </p>
        </div>
        <Link
          href="/admin/changelog?g=progression"
          className="flex h-10 items-center border border-border-strong px-4 text-xs font-bold uppercase tracking-[0.12em] text-text-muted hover:border-accent hover:text-accent"
        >
          Change log
        </Link>
      </header>

      <LevelsManager initialRows={rows} avgXpPerGame={avgXpPerGame} />
    </div>
  );
}
