/**
 * lib/player-stats/summary-accolades.ts
 * --------------------------------------------------------------------
 * Catalog and projection for the Accolades section of the Player Summary.
 *
 * Static catalog of all 15 accolades grouped into three XP-value tiers,
 * plus a projector that pulls each accolade's count out of a player row
 * into a flat shape for the section component.
 *
 * Key data decisions:
 *
 *   - Icon assets live in /public/accolades/. Filenames don't follow a
 *     consistent convention (mix of dash/underscore, mix of casing) so
 *     we hardcode the filename per accolade rather than deriving from
 *     the name.
 *
 *   - Sheet column names also vary slightly (Spray_n_Pray_Count vs the
 *     filename Spray_n_pray.png). The sheetCol field maps each accolade
 *     to its specific column. Brittle to derive — explicit is safer.
 *
 *   - Tier order: T1 (highest value) → T3. Within a tier we preserve
 *     the order from the Looker reference so the UI stays familiar to
 *     anyone who's seen the source dashboards.
 */

import { parseNumericOr } from "@/lib/sheets";
import type { PlayerStatsRaw } from "@/lib/player-stats/shared";

/** Tier values are also their XP rewards, e.g. tier 1 = 100 XP. */
export type AccoladeTier = 100 | 75 | 50;

export type AccoladeDefinition = {
  /** Display name, e.g. "Apex Predator" */
  name: string;
  /** Short explanation shown in the definitions list, e.g. "Highest KD" */
  description: string;
  /** Sheet column holding this player's count for this accolade. */
  sheetCol: string;
  /** Path under /public for the icon, e.g. "/accolades/...png" */
  iconPath: string;
  /** XP reward / tier classification. */
  tier: AccoladeTier;
};

/* ============================================================
   THE CATALOG
   Order within each tier matches the Looker reference exactly so
   anyone moving between source/portal sees the same arrangement.
   ============================================================ */

export const ACCOLADES: AccoladeDefinition[] = [
  // Tier 1 — 100 XP
  {
    name: "MVP",
    description: "Highest Score",
    sheetCol: "MVP_Count",
    iconPath: "/accolades/LaserOps-Accolades-MVP.png",
    tier: 100,
  },
  {
    name: "Reaper",
    description: "Most Kills",
    sheetCol: "Reaper_Count",
    iconPath: "/accolades/LaserOps-Accolades-Reaper.png",
    tier: 100,
  },
  {
    name: "Apex Predator",
    description: "Highest KD",
    sheetCol: "Apex_Predator_Count",
    iconPath: "/accolades/LaserOps-Accolades-Apex_Predator.png",
    tier: 100,
  },
  {
    name: "Heavy Hitter",
    description: "Most damage done",
    sheetCol: "Heavy_Hitter_Count",
    iconPath: "/accolades/LaserOps-Accolades-Heavy_Hitter.png",
    tier: 100,
  },

  // Tier 2 — 75 XP
  {
    name: "Tank",
    description: "Least Deaths",
    sheetCol: "Tank_Count",
    iconPath: "/accolades/LaserOps-Accolades-Tank.png",
    tier: 75,
  },
  {
    name: "Eagle Eye",
    description: "Highest Accuracy",
    sheetCol: "Eagle_Eye_Count",
    iconPath: "/accolades/LaserOps-Accolades-Eagle-Eye.png",
    tier: 75,
  },
  {
    name: "Specialist",
    description: "Highest Score with your gun",
    sheetCol: "Specialist_Count",
    iconPath: "/accolades/LaserOps-Accolades-Specialist.png",
    tier: 75,
  },
  {
    name: "Punisher",
    description: "Most Hits",
    sheetCol: "Punisher_Count",
    iconPath: "/accolades/LaserOps-Accolades-Punisher.png",
    tier: 75,
  },
  {
    name: "Ghost",
    description: "Least Shots Received",
    sheetCol: "Ghost_Count",
    iconPath: "/accolades/LaserOps-Accolades-Ghost.png",
    tier: 75,
  },

  // Tier 3 — 50 XP
  {
    name: "Kamikaze",
    description: "Most Deaths",
    sheetCol: "Kamikaze_Count",
    iconPath: "/accolades/LaserOps-Accolades-Kamikaze.png",
    tier: 50,
  },
  {
    name: "Rambo",
    description: "Most Shots",
    sheetCol: "Rambo_Count",
    iconPath: "/accolades/LaserOps-Accolades-Rambo.png",
    tier: 50,
  },
  {
    name: "Ammo Saver",
    description: "Least Shots",
    sheetCol: "Ammo_Saver_Count",
    iconPath: "/accolades/LaserOps-Accolades-Ammo_Saver.png",
    tier: 50,
  },
  {
    name: "Spray N Pray",
    description: "Lowest Accuracy",
    // Sheet uses lowercase n: Spray_n_Pray_Count
    sheetCol: "Spray_n_Pray_Count",
    iconPath: "/accolades/LaserOps-Accolades-Spray_n_pray.png",
    tier: 50,
  },
  {
    name: "Swiss Cheese",
    description: "Most Shots Received",
    sheetCol: "Swiss_Cheese_Count",
    iconPath: "/accolades/LaserOps-Accolades-Swiss_Cheese.png",
    tier: 50,
  },
  {
    name: "Pacifist",
    description: "Least Damage Done",
    sheetCol: "Pacifist_Count",
    iconPath: "/accolades/LaserOps-Accolades-Pacifist.png",
    tier: 50,
  },
];

/* ============================================================
   PROJECTION
   ============================================================ */

/**
 * One accolade with its count for a specific player. Same shape used
 * for both "earned" and "not earned" cases — `count` carries the value.
 */
export type AccoladeWithCount = {
  definition: AccoladeDefinition;
  count: number;
};

/**
 * Group accolades by tier. Each group also carries the player's totals
 * for that tier so the section can show a per-tier summary.
 */
export type TierGroup = {
  tier: AccoladeTier;
  /** Accolades in this tier where the player has count > 0. Display order. */
  earned: AccoladeWithCount[];
  /** All definitions in this tier (for the always-visible definitions list). */
  allInTier: AccoladeDefinition[];
  /** Sum of counts in this tier — useful for at-a-glance per-tier totals. */
  earnedCount: number;
};

export type AccoladesData = {
  /** Total accolades earned across all tiers — comes from Accolades_Total. */
  totalEarned: number;
  /** Three tier groups, in display order (T1 first). */
  tierGroups: TierGroup[];
};

/**
 * Project a player row into the accolades section's data shape.
 *
 * - We trust the sheet's Accolades_Total column for the headline number
 *   rather than re-summing here. If the sheet adds future accolades not
 *   yet in our catalog, the headline still reflects the true total.
 * - For each tier we filter the catalog down to "earned" (count > 0) for
 *   the visible cards, but keep the full tier list for the definitions
 *   row at the bottom of each tier.
 */
export function projectAccolades(row: PlayerStatsRaw): AccoladesData {
  const totalEarned = parseNumericOr(row.Accolades_Total, 0);

  // Deterministic tier order: 100 → 75 → 50.
  const tiers: AccoladeTier[] = [100, 75, 50];

  const tierGroups = tiers.map((tier) => {
    const allInTier = ACCOLADES.filter((a) => a.tier === tier);
    const withCounts: AccoladeWithCount[] = allInTier.map((definition) => ({
      definition,
      count: parseNumericOr(row[definition.sheetCol] ?? "", 0),
    }));
    const earned = withCounts.filter((a) => a.count > 0);
    const earnedCount = earned.reduce((sum, a) => sum + a.count, 0);
    return { tier, earned, allInTier, earnedCount };
  });

  return { totalEarned, tierGroups };
}
