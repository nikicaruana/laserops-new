import {
  projectAccolades,
  type AccoladeTier,
  type TierGroup,
} from "@/lib/player-stats/summary-accolades";
import { AccoladeCard } from "@/components/portal/player-summary/AccoladeCard";
import type { PlayerStatsRaw } from "@/lib/player-stats/shared";

/**
 * AccoladesSection
 * --------------------------------------------------------------------
 * The full accolades grid for the Player Summary, organised by tier.
 *
 * Structure:
 *   - Top: total accolades count (small headline)
 *   - Three tier subsections in order T1 (100 XP) → T3 (50 XP).
 *     Each tier has:
 *       1. A header line: "TIER 1 — 100 XP" or similar
 *       2. A grid of cards for accolades the player has earned (count > 0).
 *          If none earned in this tier, a small "none earned yet" line
 *          replaces the grid.
 *       3. A definitions list showing every accolade in this tier with
 *          its short description, regardless of what's earned. Always
 *          visible so the page is educational — players see what's
 *          available even before earning anything.
 *
 * Grid responsiveness: 3 cards per row on mobile, 4 on sm, 5 on xl.
 * Accolade cards have less info than stat cards (just icon + name +
 * count) so they pack tighter.
 */

type AccoladesSectionProps = {
  row: PlayerStatsRaw;
};

export function AccoladesSection({ row }: AccoladesSectionProps) {
  const data = projectAccolades(row);

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* Top line — total earned. Small headline rather than a big card,
          so it doesn't compete with the per-tier breakdown below. */}
      <div className="flex items-baseline justify-center gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
          Total Accolades
        </span>
        <span className="font-mono text-2xl font-extrabold tabular-nums text-accent sm:text-3xl">
          {data.totalEarned.toLocaleString("en-US")}
        </span>
      </div>

      {/* Tier subsections. Spacing between tiers is generous (gap-8 on the
          parent) so the visual rhythm makes the tier boundaries obvious. */}
      {data.tierGroups.map((group) => (
        <TierBlock key={group.tier} group={group} />
      ))}
    </div>
  );
}

/* ============================================================
   Per-tier block: header + cards (or empty msg) + definitions
   ============================================================ */

function TierBlock({ group }: { group: TierGroup }) {
  return (
    <section className="flex flex-col gap-3 sm:gap-4">
      <TierHeader tier={group.tier} earnedCount={group.earnedCount} />

      {/* Earned cards (or empty state if none) */}
      {group.earned.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 xl:grid-cols-5">
          {group.earned.map((a) => (
            <AccoladeCard key={a.definition.name} data={a} />
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-border bg-bg-elevated/50 px-4 py-6 text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-text-subtle">
            None earned yet
          </span>
        </div>
      )}

      {/* Definitions — always visible, even if no cards earned, so the
          section serves as a guide to what's available in each tier. */}
      <TierDefinitions group={group} />
    </section>
  );
}

/* ---------- Tier header ---------- */

function TierHeader({
  tier,
  earnedCount,
}: {
  tier: AccoladeTier;
  earnedCount: number;
}) {
  // Tier number derived from XP value: 100 → 1, 75 → 2, 50 → 3.
  // Hardcoded mapping is safer than arithmetic over enum values.
  const tierNumber = tier === 100 ? 1 : tier === 75 ? 2 : 3;
  return (
    <div className="flex items-baseline justify-between border-b border-border-strong pb-2">
      <div className="flex items-baseline gap-3">
        <span className="text-sm font-extrabold uppercase tracking-[0.18em] text-text sm:text-base">
          Tier {tierNumber}
        </span>
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-accent sm:text-sm">
          {tier} XP
        </span>
      </div>
      {earnedCount > 0 && (
        <span className="font-mono text-sm font-bold tabular-nums text-text-muted sm:text-base">
          {earnedCount.toLocaleString("en-US")}
        </span>
      )}
    </div>
  );
}

/* ---------- Definitions list ---------- */

function TierDefinitions({ group }: { group: TierGroup }) {
  return (
    // flex-wrap with column-x gap fits definitions by their natural width
    // and packs them tightly. Better scanability than a CSS Grid for short
    // text items — the grid produced columns much wider than the content,
    // making items read as isolated.
    //
    // On mobile we still want a single column (definitions one per line).
    // sm+ switches to wrapping inline so items pack horizontally.
    <ul className="flex flex-col gap-y-1 text-[0.7rem] leading-snug sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-1.5 sm:text-xs">
      {group.allInTier.map((def) => (
        <li
          key={def.name}
          className="flex items-baseline gap-2 text-text-subtle"
        >
          {/* Accolade name in semibold to anchor the line. Description
              in muted colour as supporting detail. */}
          <span className="font-semibold text-text-muted">{def.name}</span>
          <span className="text-text-subtle">— {def.description}</span>
        </li>
      ))}
    </ul>
  );
}
