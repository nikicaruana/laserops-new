/**
 * HistoryEmptyState
 * --------------------------------------------------------------------
 * Rendered on the History page when no player is selected. Mirrors the
 * Match Report's empty state pattern — soft prompt + hint about how
 * to find a player.
 */
export function HistoryEmptyState() {
  return (
    <div className="mt-8 rounded-sm border border-dashed border-border bg-bg-elevated px-6 py-16 text-center sm:py-20">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">
        Search a player to begin
      </p>
      <p className="mx-auto mt-3 max-w-md text-sm text-text-muted sm:text-base">
        Enter an Ops Tag above to see that player&apos;s match history,
        personal records, ELO progression, and per-match stat trends.
      </p>
    </div>
  );
}
