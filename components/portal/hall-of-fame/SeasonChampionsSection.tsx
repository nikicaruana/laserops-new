import type {
  ChampionEntry,
  SeasonChampions,
} from "@/lib/leaderboards/hall-of-fame";

/**
 * Season Champions — the top 2 finishers of every challenge in each
 * completed season, with the stat that won it.
 */
export function SeasonChampionsSection({
  seasons,
}: {
  seasons: SeasonChampions[];
}) {
  if (seasons.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-text-muted">
        Season champions will appear here once a season concludes.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {seasons.map((season) => (
        <section key={season.seasonNumber}>
          <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">
            {season.seasonName || `Season ${season.seasonNumber}`}
          </h2>
          <div className="mt-5 space-y-5">
            {season.challenges.map((c) => (
              <div
                key={c.challengeNumber}
                className="border border-border bg-bg-elevated p-4 sm:p-6"
              >
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">
                  Challenge {c.challengeNumber}
                </p>
                <h3 className="mt-1 text-lg font-extrabold tracking-tight">
                  {c.name}
                </h3>
                {c.description ? (
                  <p className="mt-1 text-sm leading-relaxed text-text-muted">
                    {c.description}
                  </p>
                ) : null}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {c.top.map((entry) => (
                    <ChampionCard
                      key={entry.rank}
                      entry={entry}
                      metricLabel={c.metricLabel}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ChampionCard({
  entry,
  metricLabel,
}: {
  entry: ChampionEntry;
  metricLabel: string;
}) {
  const place =
    entry.rank === 1 ? "1st Place" : entry.rank === 2 ? "2nd Place" : `${entry.rank}th Place`;
  const isFirst = entry.rank === 1;

  return (
    <div
      className={`flex items-center gap-4 border p-3 ${
        isFirst ? "border-accent bg-accent/[0.06]" : "border-border bg-bg"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={entry.profilePicUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-14 w-14 shrink-0 rounded-sm border border-border-strong object-cover sm:h-16 sm:w-16"
      />
      <div className="min-w-0 flex-1">
        <p
          className={`text-[0.6rem] font-bold uppercase tracking-[0.14em] ${
            isFirst ? "text-accent" : "text-text-subtle"
          }`}
        >
          {place}
        </p>
        <a
          href={`/player-portal/player-stats/summary?ops=${encodeURIComponent(entry.nickname)}`}
          className="block truncate font-mono text-sm font-bold text-text transition-colors hover:text-accent sm:text-base"
        >
          {entry.nickname}
        </a>
        <p className="mt-0.5 leading-tight">
          <span className="font-mono text-base font-bold tabular-nums text-accent">
            {entry.formatted}
          </span>{" "}
          <span className="text-xs text-text-muted">{metricLabel}</span>
        </p>
      </div>
    </div>
  );
}
