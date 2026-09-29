/**
 * app/player-portal/player-stats/achievements/page.tsx
 * --------------------------------------------------------------------
 * Player Stats -> Achievements. A public (any-player) summary of every ranked
 * placement the selected player holds: season challenges, all-time
 * leaderboards, all-time records, weapon mastery, accolade + streak leaders.
 * Reads ?ops= (set by the shared player-stats search bar).
 */
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPlayerAchievements } from "@/lib/leaderboards/player-achievements";
import { PlayerAchievementsView } from "@/components/portal/achievements/PlayerAchievementsView";

export const metadata: Metadata = { title: "Achievements" };

export default async function AchievementsPage({
  searchParams,
}: {
  searchParams: Promise<{ ops?: string }>;
}) {
  const { ops } = await searchParams;
  const opsTag = (ops ?? "").trim();

  if (opsTag === "") return <SearchPrompt />;

  const supabase = await createClient();
  const data = await getPlayerAchievements(supabase, opsTag);
  if (!data) return <SearchPrompt />;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PlayerAchievementsView data={data} />
    </div>
  );
}

function SearchPrompt() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="portal-card px-6 py-12 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
          Enter an ops tag to view achievements
        </p>
        <p className="mt-2 text-sm text-text-subtle">
          Start typing in the search field above – suggestions will appear.
        </p>
      </div>
    </div>
  );
}
