import type { AccoladeLeaders } from "@/lib/leaderboards/hall-of-fame";

/**
 * Accolade Leaders — for every accolade, the top 3 players who have earned
 * it the most, alongside the accolade's badge and what it's awarded for.
 * The catalog is already ordered by tier (100 → 75 → 50 XP).
 */
export function AccoladeLeadersSection({
  accolades,
}: {
  accolades: AccoladeLeaders[];
}) {
  if (accolades.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-text-muted">
        Accolade leaders will appear here once match data is available.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-5 text-center text-sm text-text-muted">
        The players who have earned the most of each accolade.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {accolades.map((acc) => (
          <div
            key={acc.name}
            className="border border-border bg-bg-elevated p-4 sm:p-5"
          >
            {/* Accolade header — badge + name + what it's for */}
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={acc.iconPath}
                alt={acc.name}
                loading="lazy"
                decoding="async"
                className="h-14 w-14 shrink-0 object-contain"
              />
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold uppercase tracking-[0.1em] text-accent sm:text-base">
                  {acc.name}
                </h3>
                <p className="text-xs text-text-muted">{acc.description}</p>
                <p className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-text-subtle">
                  {acc.tier} XP
                </p>
              </div>
            </div>

            {/* Top 3 holders */}
            {acc.entries.length === 0 ? (
              <p className="mt-4 py-2 text-center text-xs text-text-muted">
                Not yet earned.
              </p>
            ) : (
              <ol className="mt-4 space-y-2">
                {acc.entries.map((e) => (
                  <li
                    key={`${acc.name}-${e.rank}-${e.nickname}`}
                    className="flex items-center gap-3"
                  >
                    <span className="w-4 shrink-0 text-center font-mono text-xs font-bold text-text-subtle">
                      {e.rank}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={e.profilePicUrl}
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
