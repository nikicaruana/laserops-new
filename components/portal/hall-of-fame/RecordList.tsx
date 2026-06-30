import type { RecordEntry } from "@/lib/leaderboards/hall-of-fame";

/**
 * RecordList
 * --------------------------------------------------------------------
 * A compact top-3 list for one record metric. Presentational only (no
 * hooks / no "use client") so it can render inside both server sections
 * (All-Time Records) and the client Weapon Masters accordion.
 *
 * Each row links to the match the record was set in, when known.
 */

type Props = {
  label: string;
  note?: string;
  entries: RecordEntry[];
};

export function RecordList({ label, note, entries }: Props) {
  return (
    <div className="border border-border bg-bg-elevated p-4 sm:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-extrabold uppercase tracking-[0.1em] text-accent sm:text-base">
          {label}
        </h3>
        {note ? (
          <span className="shrink-0 text-[0.55rem] font-semibold uppercase tracking-[0.1em] text-text-subtle">
            {note}
          </span>
        ) : null}
      </div>

      {entries.length === 0 ? (
        <p className="py-3 text-center text-xs text-text-muted">No records yet.</p>
      ) : (
        <ol className="space-y-2">
          {entries.map((e) => {
            const value = e.matchId ? (
              <a
                href={`/match-report?match=${encodeURIComponent(e.matchId)}`}
                className="shrink-0 font-mono text-sm font-bold tabular-nums text-text transition-colors hover:text-accent sm:text-base"
              >
                {e.formatted}
              </a>
            ) : (
              <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-text sm:text-base">
                {e.formatted}
              </span>
            );

            return (
              <li
                key={`${e.rank}-${e.nickname}-${e.matchId}`}
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
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-text sm:text-sm">
                  {e.nickname}
                </span>
                {value}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
