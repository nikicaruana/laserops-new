import {
  projectMatchWinsCard,
  projectRoundWinsCard,
  projectKillsCard,
  projectDamageCard,
  projectCapturesCard,
  projectCaptureTimeCard,
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
 * Nine cards in this order, grouped by what they communicate:
 *   1. Matches Won + Win Rate     ┐
 *   2. Rounds Won + W/L Ratio     ┘ wins / consistency
 *   3. Kills / Round              ┐
 *   4. Damage / Round             ┘ combat output
 *   5. Captures / Round           ┐
 *   6. Hold Time / Round          ┘ objective play (online only)
 *   7. Avg Match Rating             performance score
 *   8. Accuracy                   ┐
 *   9. K/D Ratio                  ┘ skill ratios
 *
 * Responsive grid:
 *   - Mobile: 2 cards per row
 *   - sm (640+): 3 cards per row
 *   - xl (1280+): 4 cards per row
 *
 * 9 cards lays out cleanly at 3 per row (3×3); the 2- and 4-col breakpoints
 * carry a single card on the final row.
 */

type StatsSectionProps = {
  row: PlayerStatsRaw;
  /** Whether the player has unlocked ratings – passed to each StatCard so
   *  locked players show the locked rating image instead of a 0-star grid. */
  ratingUnlocked: boolean;
};

export function StatsSection({ row, ratingUnlocked }: StatsSectionProps) {
  // Project once. Order here is the render order – adjust if a different
  // grouping reads better in practice.
  const cards = [
    projectMatchWinsCard(row),
    projectRoundWinsCard(row),
    projectKillsCard(row),
    projectDamageCard(row),
    projectCapturesCard(row),
    projectCaptureTimeCard(row),
    projectMatchRatingCard(row),
    projectAccuracyCard(row),
    projectKdRatioCard(row),
  ];

  return (
    // gap-x: tight horizontal gap between cards in a row.
    // gap-y: wider so overhanging rating pills fit between rows.
    // pb: padding-bottom equal to roughly half a pill's height. The
    //   overhanging pills on the LAST row need a place to live inside
    //   the section's bounds – without this padding, the parent
    //   <details> element's overflow:clip during animation would clip
    //   them, and they'd visibly disappear at the open/close edge.
    //   Padding moves them inside the clipping rectangle while keeping
    //   the visual overhang.
    <div className="grid grid-cols-2 gap-x-3 gap-y-7 pb-6 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-8 sm:pb-7 xl:grid-cols-4">
      {cards.map((card) => (
        <StatCard key={card.label} card={card} ratingUnlocked={ratingUnlocked} />
      ))}
    </div>
  );
}
