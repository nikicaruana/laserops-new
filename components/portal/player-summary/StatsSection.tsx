import {
  projectMatchWinsCard,
  projectRoundWinsCard,
  projectKillsCard,
  projectDamageCard,
  projectScoreCard,
  projectAccuracyCard,
  projectKdRatioCard,
  projectMatchRatingCard,
} from "@/lib/player-stats/summary-stats";
import { StatCard } from "@/components/portal/player-summary/StatCard";
import type { PlayerStatsRaw } from "@/lib/player-stats/shared";

/**
 * StatsSection
 * --------------------------------------------------------------------
 * Grid of StatCards for the Player Summary's stats area.
 *
 * Eight cards in this order, grouped by what they communicate:
 *   1. Matches Won + Win Rate     ┐
 *   2. Rounds Won + W/L Ratio     ┘ wins / consistency
 *   3. Total Kills + Per Match    ┐
 *   4. Total Damage + Per Match   ┘ combat output
 *   5. Total Score + Per Match    ┐
 *   6. Avg Match Rating           ┘ performance score
 *   7. Accuracy                   ┐
 *   8. K/D Ratio                  ┘ skill ratios
 *
 * Responsive grid:
 *   - Mobile: 2 cards per row
 *   - sm (640+): 3 cards per row
 *   - xl (1280+): 4 cards per row
 *
 * 8 cards divides evenly across all three layouts (4×2, then perfect 2×4
 * on mobile, 3+3+2 on tablet, 4×2 on desktop). Looks intentional at every
 * breakpoint with no awkward orphan rows.
 */

type StatsSectionProps = {
  row: PlayerStatsRaw;
};

export function StatsSection({ row }: StatsSectionProps) {
  // Project once. Order here is the render order — adjust if a different
  // grouping reads better in practice.
  const cards = [
    projectMatchWinsCard(row),
    projectRoundWinsCard(row),
    projectKillsCard(row),
    projectDamageCard(row),
    projectScoreCard(row),
    projectMatchRatingCard(row),
    projectAccuracyCard(row),
    projectKdRatioCard(row),
  ];

  return (
    // gap-x: tight horizontal gap between cards in a row.
    // gap-y: wider so overhanging rating pills fit between rows.
    // pb: padding-bottom equal to roughly half a pill's height. The
    //   overhanging pills on the LAST row need a place to live inside
    //   the section's bounds — without this padding, the parent
    //   <details> element's overflow:clip during animation would clip
    //   them, and they'd visibly disappear at the open/close edge.
    //   Padding moves them inside the clipping rectangle while keeping
    //   the visual overhang.
    <div className="grid grid-cols-2 gap-x-3 gap-y-7 pb-4 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-8 sm:pb-5 xl:grid-cols-4">
      {cards.map((card) => (
        <StatCard key={card.label} card={card} />
      ))}
    </div>
  );
}
