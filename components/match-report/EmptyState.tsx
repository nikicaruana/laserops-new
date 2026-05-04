/**
 * MatchReportEmptyState
 * --------------------------------------------------------------------
 * Rendered on /match-report when no match is selected (no `match`
 * query param). Helpful prompt directing the user to use the search
 * box above.
 */
export function MatchReportEmptyState() {
  return (
    <div className="rounded-sm border border-dashed border-border bg-bg-elevated px-6 py-16 text-center sm:py-20">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">
        Enter a Match ID to begin
      </p>
      <p className="mx-auto mt-3 max-w-md text-sm text-text-muted sm:text-base">
        Type or pick a Match ID above to pull up its full report —
        team scores, player breakdown, accolades, and more.
      </p>
      <p className="mx-auto mt-3 max-w-md text-xs text-text-subtle">
        Match IDs look like <span className="font-mono text-text-muted">LO-2026-10</span>.
        Recent matches show first in the dropdown.
      </p>
    </div>
  );
}
