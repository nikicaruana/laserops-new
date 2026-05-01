/**
 * TableErrorState — renders when a leaderboard data fetch fails.
 *
 * Visual design intent: doesn't shout "ERROR" with red. The portal aesthetic
 * is gritty but composed; an error here is more "no contact" than "alarm".
 * Uses muted text and the existing border treatment so it sits inside the
 * page where the table would have been.
 */
type TableErrorStateProps = {
  /** Optional debug string. Hidden from users; placed in title attribute. */
  detail?: string;
};

export function TableErrorState({ detail }: TableErrorStateProps) {
  return (
    <div
      role="alert"
      title={detail}
      className="border border-border bg-bg-elevated px-6 py-12 text-center"
    >
      <div className="mx-auto flex max-w-md flex-col items-center gap-3">
        <span aria-hidden className="text-2xl text-text-subtle">⌧</span>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
          Couldn&apos;t load leaderboard
        </p>
        <p className="text-sm text-text-subtle">
          Try refreshing the page. If it keeps failing, the live data feed may
          be temporarily unavailable.
        </p>
      </div>
    </div>
  );
}
