import type { PlayerAchievements, AchievementItem } from "@/lib/leaderboards/player-achievements";
import { cn } from "@/lib/cn";

/**
 * PlayerAchievementsView
 * --------------------------------------------------------------------
 * Renders a player's ranked placements across every competitive surface,
 * grouped by source. Each item shows its placing (gold/silver/bronze for the
 * podium, #N for 4-10) with the metric and value. Presentational only.
 */
export function PlayerAchievementsView({ data }: { data: PlayerAchievements }) {
  const nonEmpty = data.groups.filter((g) => g.items.length > 0);

  if (data.totalCount === 0) {
    return (
      <div className="portal-card px-6 py-12 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">No achievements yet</p>
        <p className="mt-2 text-sm text-text-subtle">
          {data.nickname} hasn&apos;t placed on any leaderboard, record, or Hall of Fame board yet. Keep playing – placings show up here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-4">
        <h2 className="text-lg font-extrabold uppercase tracking-tight text-text sm:text-xl">
          {data.nickname}&apos;s Achievements
        </h2>
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
          {data.totalCount.toLocaleString("en-US")} placing{data.totalCount === 1 ? "" : "s"}
        </span>
      </header>

      {nonEmpty.map((group) => (
        <section key={group.key} className="space-y-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-accent">{group.title}</h3>
            <p className="mt-0.5 text-xs text-text-subtle">{group.blurb}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {group.items.map((item, i) => (
              <li key={`${group.key}-${i}`} className="flex items-center gap-3 portal-card p-3 sm:p-4">
                <Placing rank={item.rank} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text">{item.label}</p>
                  {item.detail ? <p className="truncate text-xs text-text-muted">{item.detail}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* ---------- Placing medal ---------- */

function Placing({ rank }: { rank: AchievementItem["rank"] }) {
  const label = rank === 1 ? "1st" : rank === 2 ? "2nd" : rank === 3 ? "3rd" : `#${rank}`;
  const styles =
    rank === 1
      ? "border-accent bg-accent/15 text-accent"
      : rank === 2
        ? "border-slate-400/50 bg-slate-400/10 text-slate-300"
        : rank === 3
          ? "border-amber-600/50 bg-amber-600/10 text-amber-500"
          : "border-border bg-bg-elevated text-text-muted";
  return (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border font-mono text-xs font-bold tabular-nums sm:h-11 sm:w-11 sm:text-sm",
        styles,
      )}
      aria-label={`Placed ${label}`}
    >
      {label}
    </span>
  );
}
