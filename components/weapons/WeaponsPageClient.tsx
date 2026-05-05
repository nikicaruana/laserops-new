"use client";

import { useCallback, useMemo, useState } from "react";
import {
  type Weapon,
  compareFireRate,
  compareHigherWins,
  compareLowerWins,
} from "@/lib/cms/weapons";
import { WeaponGallery } from "./WeaponGallery";
import type { StatWinners } from "./WeaponStatsPanel";

/**
 * WeaponsPageClient
 * --------------------------------------------------------------------
 * Top-level interactive shell for the /weapons page.
 *
 * State owned here:
 *   - Compare toggle (boolean)
 *   - Centred weapon for gallery A and gallery B (lifted from the
 *     gallery components so we can compute compare-mode winners).
 *
 * Each gallery owns its OWN tree-filter state internally — so in
 * compare mode the two galleries can show different trees. The
 * filter dropdown moves into each gallery as a result.
 *
 * Lifting the centred-weapon state up here lets us compute
 * superiority winners for each stat (per the comparison rules in
 * lib/cms/weapons.ts) and pass them BACK down to the stats panels
 * for highlighting.
 */

type Props = {
  allWeapons: Weapon[];
  treeBranches: string[];
};

export function WeaponsPageClient({ allWeapons, treeBranches }: Props) {
  const [compareEnabled, setCompareEnabled] = useState(false);

  // Lifted centred-weapon state. The galleries report their
  // currently-centred weapon up via onCenteredChange. The parent
  // uses both values to compute winners and passes them back
  // down. Cyclical-looking but not a render loop because the
  // child notifies in an effect, not during render.
  const [weaponA, setWeaponA] = useState<Weapon | null>(null);
  const [weaponB, setWeaponB] = useState<Weapon | null>(null);

  // Compute winners only when in compare mode and both weapons are
  // present. Otherwise null → galleries skip highlighting entirely.
  const winners = useMemo<{
    a: StatWinners | null;
    b: StatWinners | null;
  }>(() => {
    if (!compareEnabled || !weaponA || !weaponB) {
      return { a: null, b: null };
    }
    return computeWinners(weaponA, weaponB);
  }, [compareEnabled, weaponA, weaponB]);

  // Stable callbacks for the gallery onCenteredChange. useCallback
  // not strictly necessary but cheap — it lets us pass the same
  // reference each render and the gallery's effect won't re-trigger
  // unnecessarily.
  const handleACentered = useCallback((w: Weapon | null) => setWeaponA(w), []);
  const handleBCentered = useCallback((w: Weapon | null) => setWeaponB(w), []);

  return (
    <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8">
      {/* Page-level controls — just the compare toggle now. The tree
          filter moved INTO each gallery so they can be independent
          in compare mode. */}
      <div className="flex justify-center">
        <CompareToggle
          enabled={compareEnabled}
          onChange={setCompareEnabled}
        />
      </div>

      {/* Gallery A — top, default layout (gun image card up top,
          stats below). */}
      <WeaponGallery
        allWeapons={allWeapons}
        treeBranches={treeBranches}
        ariaLabel={
          compareEnabled
            ? "Weapon A — top gallery"
            : "Weapons gallery"
        }
        statsAriaLabel={
          compareEnabled ? "Stats for Weapon A" : "Selected weapon stats"
        }
        // In compare mode, hide the secondary row and apply
        // winner highlighting to the primary stats.
        hideStatsSecondary={compareEnabled}
        winners={winners.a}
        onCenteredChange={handleACentered}
      />

      {compareEnabled && (
        <>
          <CompareSeparator />
          {/* Gallery B — inverted layout. Stats above the scroller
              so they sit closest to the divider; gun card sits at
              the bottom of the page so the two cards effectively
              face away from each other (and the comparable values
              face each other across the divider). */}
          <WeaponGallery
            key="compare-gallery"
            allWeapons={allWeapons}
            treeBranches={treeBranches}
            ariaLabel="Weapon B — bottom gallery"
            statsAriaLabel="Stats for Weapon B"
            inverted
            hideStatsSecondary={true}
            winners={winners.b}
            onCenteredChange={handleBCentered}
          />
        </>
      )}
    </div>
  );
}

/* ---------- Winner computation ---------- */

/**
 * Compare two weapons stat by stat, return per-stat winner flags
 * for both. The four primary stats with their comparison rules:
 *
 *   - Mag size:  higher wins
 *   - Damage:    higher wins
 *   - Reload:    LOWER wins (faster reload is better)
 *   - Fire rate: full-auto > semi-auto, then higher RPM wins
 *
 * Each stat returns "win" | "lose" | "tie" relative to that gun.
 * "tie" includes ties and missing-data cases where neither gun
 * should appear to win.
 */
function computeWinners(a: Weapon, b: Weapon): {
  a: StatWinners;
  b: StatWinners;
} {
  // Helper: convert a "a"/"b"/"tie" comparison result into per-side
  // win/tie/lose flags. On a tie BOTH sides get "tie" (which the
  // stats panel now renders as a highlight, same as "win") — when
  // neither gun loses, neither tile should look "lost."
  const flag = (result: "a" | "b" | "tie", side: "a" | "b") => {
    if (result === "tie") return "tie" as const;
    if (result === side) return "win" as const;
    return "lose" as const;
  };

  const magResult = compareHigherWins(a.magSize, b.magSize);
  const dmgResult = compareHigherWins(a.damage, b.damage);
  const rldResult = compareLowerWins(a.reloadSeconds, b.reloadSeconds);
  const frResult = compareFireRate(a.fireRate, b.fireRate);

  return {
    a: {
      magSize: flag(magResult, "a"),
      damage: flag(dmgResult, "a"),
      reload: flag(rldResult, "a"),
      fireRate: flag(frResult, "a"),
    },
    b: {
      magSize: flag(magResult, "b"),
      damage: flag(dmgResult, "b"),
      reload: flag(rldResult, "b"),
      fireRate: flag(frResult, "b"),
    },
  };
}

/* ---------- Compare toggle ---------- */

/**
 * Pill toggle. Hidden checkbox + styled spans, sr-only input keeps
 * keyboard + screen reader behaviour native. Centred at the top of
 * the page so it reads as a "mode switch" rather than a sub-control.
 */
function CompareToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 sm:gap-4">
      <span className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-text-muted sm:text-xs">
        Compare Guns
      </span>
      <span className="relative inline-block h-6 w-11 select-none">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
          aria-label="Compare guns"
        />
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-bg-overlay transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent"
        />
        <span
          aria-hidden
          className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-text shadow transition-transform peer-checked:translate-x-5 peer-checked:bg-bg"
        />
      </span>
    </label>
  );
}

/* ---------- VS separator between compare galleries ---------- */

function CompareSeparator() {
  return (
    // Tighter vertical (was py-2 → py-1) for the compact mobile fit.
    <div className="relative flex items-center justify-center py-1">
      <div aria-hidden className="absolute inset-x-0 h-px bg-border" />
      <span className="relative bg-bg px-4 text-xs font-extrabold uppercase tracking-[0.3em] text-text-muted">
        vs
      </span>
    </div>
  );
}
