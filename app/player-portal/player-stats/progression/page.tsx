/**
 * app/player-portal/player-stats/progression/page.tsx
 * --------------------------------------------------------------------
 * A player's own progression, grouped into tiers of 5 levels. Each level shows
 * its badge, an animated progress bar, and any reward unlocked along the way -
 * with the reward's coin/boost art shown (blurred until reached). OWN STATS ONLY
 * - if the ?ops= player isn't the signed-in user, we show a notice rather than
 * someone else's progression.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProgressionLadder, type LevelRow } from "@/components/portal/progression/ProgressionLadder";

export const metadata: Metadata = { title: "Progression" };

type Rank = { level: number; rank_name: string | null; badge_url: string | null; score_threshold: number | null };
type Unlock = { level: number; title: string | null; description: string | null; icon_url: string | null; reward_tokens: number | null; reward_double_xp: number | null; reward_xp_1_5: number | null };

export default async function ProgressionPage({ searchParams }: { searchParams: Promise<{ ops?: string }> }) {
  const ops = (await searchParams).ops ?? "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/player-portal/login?next=/player-portal/player-stats/progression`);

  const { data: account } = await supabase.from("accounts").select("id, ops_tag").eq("auth_user_id", user.id).maybeSingle();
  const ownOps = (account?.ops_tag ?? "").trim();

  // Own-only: if a different player is in context, don't show their progression.
  if (ops && ownOps && ops.trim().toLowerCase() !== ownOps.toLowerCase()) {
    return (
      <div className="mx-auto max-w-md portal-card px-6 py-10 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">Your progression only</p>
        <p className="mt-2 text-xs text-text-subtle">This tab shows your own level progression. Switch to your profile to see it.</p>
        {ownOps && (
          <Link href={`/player-portal/player-stats/progression?ops=${encodeURIComponent(ownOps)}`} className="mt-4 inline-block text-xs font-bold uppercase tracking-[0.12em] text-accent hover:text-accent-soft">
            Go to my progression
          </Link>
        )}
      </div>
    );
  }

  const [{ data: ranks }, { data: unlocks }, { data: life }, { data: boostRows }, { data: rewardImgs }] = await Promise.all([
    supabase.from("rank_levels").select("level, rank_name, badge_url, score_threshold").order("level"),
    supabase.from("level_unlocks").select("level, title, description, icon_url, reward_tokens, reward_double_xp, reward_xp_1_5").eq("is_active", true),
    account ? supabase.from("player_stats_lifetime").select("current_level, total_xp").eq("account_id", account.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.rpc("my_xp_boosts"),
    supabase.from("reward_images").select("key, image_url"),
  ]);

  const boosts = { double: 0, one_five: 0 };
  for (const b of (boostRows ?? []) as { boost_type: string; balance: number }[]) {
    if (b.boost_type === "double") boosts.double = Number(b.balance) || 0;
    if (b.boost_type === "one_five") boosts.one_five = Number(b.balance) || 0;
  }

  // Reward art by type (admin-uploaded coin / boost images).
  const imgByKey = new Map<string, string>();
  for (const ri of (rewardImgs ?? []) as { key: string; image_url: string | null }[]) imgByKey.set(ri.key, ri.image_url ?? "");

  const rankRows = (ranks ?? []) as Rank[];
  const unlockByLevel = new Map<number, Unlock>();
  for (const u of (unlocks ?? []) as Unlock[]) unlockByLevel.set(u.level, u);

  const currentLevel = Number((life as { current_level?: number } | null)?.current_level ?? 0);
  const totalXp = Number((life as { total_xp?: number } | null)?.total_xp ?? 0);

  const thresholdByLevel = new Map<number, number>();
  for (const r of rankRows) thresholdByLevel.set(r.level, Number(r.score_threshold ?? 0));

  const rows: LevelRow[] = rankRows.map((r) => {
    const cur = Number(r.score_threshold ?? 0);
    const next = thresholdByLevel.get(r.level + 1);
    let pct: number;
    if (currentLevel > r.level) pct = 100;
    else if (currentLevel < r.level) pct = 0;
    else if (next == null || next <= cur) pct = 100; // top level reached
    else pct = Math.max(0, Math.min(100, ((totalXp - cur) / (next - cur)) * 100));

    const u = unlockByLevel.get(r.level);
    const rewardTokens = Number(u?.reward_tokens ?? 0);
    const rewardDoubleXp = Number(u?.reward_double_xp ?? 0);
    const rewardXp15 = Number(u?.reward_xp_1_5 ?? 0);
    // Reward art by type (1.5x boost / double-XP boost / game token coin).
    const rewardImageUrl =
      rewardXp15 > 0 ? imgByKey.get("xp_boost_1_5x") ?? "" : rewardDoubleXp > 0 ? imgByKey.get("xp_boost_2x") ?? "" : rewardTokens > 0 ? imgByKey.get("game_token") ?? "" : "";

    return {
      level: r.level,
      rankName: r.rank_name ?? "",
      badgeUrl: r.badge_url ?? "",
      reached: currentLevel >= r.level,
      pct,
      prizeTitle: (u?.title ?? "").trim(),
      prizeDescription: (u?.description ?? "").trim(),
      prizeIconUrl: (u?.icon_url ?? "").trim(),
      rewardImageUrl,
      rewardTokens,
      rewardDoubleXp,
      rewardXp15,
    };
  });

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Progression</h1>
        <p className="mt-2 text-sm text-text-muted">
          Climb the ranks. Levelling up unlocks rewards along the way. You&apos;re currently{" "}
          <span className="font-bold text-accent">Level {currentLevel || 1}</span>.
        </p>
        {(boosts.double > 0 || boosts.one_five > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {boosts.double > 0 && (
              <span className="border border-accent/50 bg-accent/10 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.08em] text-accent">
                {boosts.double} × Double XP boost
              </span>
            )}
            {boosts.one_five > 0 && (
              <span className="border border-accent/50 bg-accent/10 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.08em] text-accent">
                {boosts.one_five} × 1.5x XP boost
              </span>
            )}
            <span className="self-center text-[0.7rem] text-text-subtle">Use these when you sign in to a game.</span>
          </div>
        )}
      </header>
      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">No levels are configured yet.</p>
      ) : (
        <ProgressionLadder rows={rows} currentLevel={currentLevel} />
      )}
    </div>
  );
}
