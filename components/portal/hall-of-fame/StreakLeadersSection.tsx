import type { StreakLeaders } from "@/lib/leaderboards/hall-of-fame";
import { cldImage } from "@/lib/cld";

/**
 * Streak Leaders – for every streak, the top 3 players who have earned it the
 * most, alongside the streak's badge, what it's awarded for, and its in-game
 * points. Streak names/points/badges/order are admin-authoritative (they come
 * from streak_definitions), so this matches the streaks page and match reports.
 */
export function StreakLeadersSection({ streaks }: { streaks: StreakLeaders[] }) {
  if (streaks.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-text-muted">
        Streak leaders will appear here once match data is available.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-5 text-center text-sm text-text-muted">
        The players who have earned the most of each streak.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {streaks.map((st) => (
          <div key={st.streakKey} className="portal-card p-4 sm:p-5">
            {/* Streak header – badge + name + what it's for + points */}
            <div className="flex items-center gap-3">
              {st.badgeUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={cldImage(st.badgeUrl, { w: 168 })}
                  alt={st.name}
                  loading="lazy"
                  decoding="async"
                  className="h-14 w-14 shrink-0 object-contain"
                />
              ) : (
                <div className="h-14 w-14 shrink-0" aria-hidden />
              )}
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold uppercase tracking-[0.1em] text-accent sm:text-base">
                  {st.name}
                </h3>
                {st.description ? (
                  <p className="text-xs text-text-muted">{st.description}</p>
                ) : null}
                <p className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-text-subtle">
                  {st.points.toLocaleString("en-US")} pts
                </p>
              </div>
            </div>

            {/* Top 3 holders by times earned */}
            {st.entries.length === 0 ? (
              <p className="mt-4 py-2 text-center text-xs text-text-muted">
                Not yet earned.
              </p>
            ) : (
              <ol className="mt-4 space-y-2">
                {st.entries.map((e) => (
                  <li key={`${st.streakKey}-${e.rank}-${e.nickname}`} className="flex items-center gap-3">
                    <span className="w-4 shrink-0 text-center font-mono text-xs font-bold text-text-subtle">
                      {e.rank}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cldImage(e.profilePicUrl, { w: 384 })}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-8 w-8 shrink-0 rounded-sm border border-border-strong object-cover sm:h-9 sm:w-9"
                    />
                    <a
                      href={`/player-portal/player-stats/summary?ops=${encodeURIComponent(e.nickname)}`}
                      className="min-w-0 flex-1 truncate text-xs font-semibold text-text transition-colors hover:text-accent sm:text-sm"
                    >
                      {e.nickname}
                    </a>
                    <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-text sm:text-base">
                      {e.count.toLocaleString("en-US")}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
