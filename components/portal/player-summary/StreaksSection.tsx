/**
 * components/portal/player-summary/StreaksSection.tsx
 * --------------------------------------------------------------------
 * Streaks grid for the Player Summary, below Accolades. Shows EVERY streak
 * (admin-defined in streak_definitions), grouped by tier, with the ones the
 * player hasn't earned yet greyed out + a "Locked" pill - same treatment as the
 * accolades. Earned counts come from v_hof_streak_leaders (times_earned).
 *
 * Each card is clickable and opens the shared BadgeDetailDialog popup (big badge
 * on the left, description on the right) so players can read what every streak
 * is - including the locked ones.
 */
import { cldImage } from "@/lib/cld";
import { BadgeDetailDialog } from "@/components/portal/BadgeDetailDialog";

export type StreakItem = {
  streakKey: string;
  name: string;
  description: string | null;
  badgeUrl: string | null;
  tier: number;
  count: number;
};

function StreakCard({ item }: { item: StreakItem }) {
  const locked = item.count === 0;
  return (
    <BadgeDetailDialog
      kind="Streak"
      name={item.name}
      description={item.description}
      badgeUrl={item.badgeUrl}
      footer={`Tier ${item.tier}`}
      ariaLabel={`${item.name} - tap for details`}
      triggerClassName="h-full"
    >
      <div className={`flex h-full flex-col items-center gap-2 portal-card p-3 text-center sm:gap-3 sm:p-4 ${locked ? "opacity-50" : ""}`}>
        {item.badgeUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cldImage(item.badgeUrl, { w: 320 })}
            alt={`${item.name} streak`}
            loading="lazy"
            decoding="async"
            className={`block h-auto w-full max-w-[10rem] ${locked ? "grayscale" : ""}`}
          />
        ) : (
          <div className="flex aspect-square w-full max-w-[10rem] items-center justify-center text-3xl text-text-subtle">&#9733;</div>
        )}
        <span className="text-[0.7rem] font-bold uppercase leading-tight tracking-[0.06em] text-text sm:text-xs">{item.name}</span>
        <div className="mt-auto rounded-sm border border-border-strong bg-bg-overlay px-3 py-1 sm:px-4 sm:py-1.5">
          {locked ? (
            <span className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-text-subtle sm:text-xs">Locked</span>
          ) : (
            <span className="font-mono text-sm font-bold tabular-nums text-text sm:text-base">{item.count.toLocaleString("en-US")}</span>
          )}
        </div>
      </div>
    </BadgeDetailDialog>
  );
}

export function StreaksSection({ streaks }: { streaks: StreakItem[] }) {
  if (streaks.length === 0) {
    return <p className="text-sm text-text-subtle">No streaks configured yet.</p>;
  }
  const totalEarned = streaks.reduce((s, x) => s + x.count, 0);
  const tiers = Array.from(new Set(streaks.map((s) => s.tier))).sort((a, b) => b - a);

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="flex items-baseline justify-center gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">Total Streaks</span>
        <span className="font-mono text-2xl font-extrabold tabular-nums text-accent sm:text-3xl">{totalEarned.toLocaleString("en-US")}</span>
      </div>

      {tiers.map((tier) => {
        const items = streaks.filter((s) => s.tier === tier);
        const earnedCount = items.reduce((s, x) => s + x.count, 0);
        return (
          <section key={tier} className="flex flex-col gap-3 sm:gap-4">
            <div className="flex items-baseline justify-between border-b border-border-strong pb-2">
              <span className="text-sm font-extrabold uppercase tracking-[0.18em] text-text sm:text-base">Tier {tier}</span>
              {earnedCount > 0 && (
                <span className="font-mono text-sm font-bold tabular-nums text-text-muted sm:text-base">{earnedCount.toLocaleString("en-US")}</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 xl:grid-cols-5">
              {items.map((it) => <StreakCard key={it.streakKey} item={it} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
