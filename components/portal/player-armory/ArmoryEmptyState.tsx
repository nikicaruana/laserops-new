/**
 * ArmoryEmptyState
 * --------------------------------------------------------------------
 * Rendered on the Armory page when no player is selected. Mirrors
 * HistoryEmptyState's tone and styling for consistency across portal
 * sub-pages.
 */
export function ArmoryEmptyState() {
  return (
    <div className="mt-8 rounded-sm border border-dashed border-border bg-bg-elevated px-6 py-16 text-center sm:py-20">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">
        Search a player to begin
      </p>
      <p className="mx-auto mt-3 max-w-md text-sm text-text-muted sm:text-base">
        Enter an Ops Tag above to see that player&apos;s armory — every
        gun in the catalogue, grouped by tree branch, with their personal
        stats on each unlocked weapon and unlock progress on the locked
        ones.
      </p>
    </div>
  );
}
