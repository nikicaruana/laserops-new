import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { fetchWeapons, listGunTreeBranches } from "@/lib/cms/weapons";
import { fetchWeaponUsageStats } from "@/lib/weapons/usage-stats";
import { WeaponsPageClient } from "@/components/weapons/WeaponsPageClient";
import { WeaponMetaChart } from "@/components/weapons/WeaponMetaChart";

/**
 * /weapons
 * --------------------------------------------------------------------
 * Public weapons gallery. Linked from the homepage's "View All
 * Weapons" CTA (in WeaponsSection.tsx).
 *
 * Server component: fetches the weapons sheet at request time
 * (cached 30min via the CMS module) and hands the data to
 * WeaponsPageClient as a prop. The client owns all the interactivity:
 * tree-filter state, compare-toggle state, scroll-snap scrolling,
 * centred-card detection.
 *
 * Below the gallery, the WeaponMetaChart renders a bubble chart of
 * per-gun usage stats aggregated from Game_Data_Lookup_Public. The
 * two fetches happen in parallel via Promise.all so the page TTFB
 * isn't degraded by the usage-stats walk.
 *
 * Empty / failure state: if either fetch fails or returns no rows,
 * the affected section renders an empty-state message but doesn't
 * blow up the whole page.
 */

export const metadata: Metadata = {
  title: "Weapons — LaserOps Malta",
  description:
    "Explore LaserOps Malta's tactical weapons arsenal. Compare stats across 15+ guns, browse by gun tree, and see unlock paths.",
};

export default async function WeaponsPage() {
  // Sequence the two fetches: weapons CMS first, then game-data
  // aggregation enriched with the per-gun tree-branch lookup. The
  // aggregator needs the lookup so each WeaponUsageStats entry knows
  // which tree the gun belongs to, which the meta-chart's tree filter
  // depends on.
  //
  // We accept the small wall-time hit (sum vs max) of sequencing
  // because it keeps the data flow straightforward — alternative
  // would be running stats without the lookup and then mutating
  // entries to attach treeBranch after the fact, which is messier
  // and makes the aggregator's contract ambiguous.
  //
  // Catches in each upstream fetcher return empty arrays on failure,
  // so this never rejects.
  const weapons = await fetchWeapons();
  const treeBranches = listGunTreeBranches(weapons);
  // Build a lookup map of gun name -> tree branch for the aggregator.
  // Built once here, used inside the per-row aggregation in
  // fetchWeaponUsageStats. O(n) on weapons (small).
  const treeBranchByName = new Map(
    weapons.map((w) => [w.name, w.treeBranch]),
  );
  const usageStats = await fetchWeaponUsageStats(treeBranchByName);

  return (
    <main className="min-h-screen bg-bg pb-16 pt-10 sm:pb-24 sm:pt-14 lg:pb-32 lg:pt-20">
      <Container size="wide">
        {/* Page heading. Mirrors the marketing-page tone of other top-
            level routes: small uppercase eyebrow + big bold heading. */}
        <header className="mb-8 sm:mb-12 lg:mb-16">
          <div className="flex items-center gap-3">
            <span aria-hidden className="block h-px w-12 bg-accent" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Arsenal
            </span>
          </div>
          <h1 className="mt-4 text-balance text-4xl font-extrabold leading-[1.05] text-text sm:text-5xl lg:text-6xl">
            Weapons.
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-text-muted sm:text-base">
            Browse the full LaserOps loadout. Filter by gun tree, swipe
            to scrub through the gallery, or toggle compare to put two
            weapons side by side.
          </p>
        </header>

        {weapons.length === 0 ? (
          <EmptyState />
        ) : (
          <WeaponsPageClient
            allWeapons={weapons}
            treeBranches={treeBranches}
          />
        )}

        {/* Bubble chart below the gallery. mt-12 / mt-16 / mt-20 gives
            it clear visual separation from the gallery — without that
            gap it reads as "more chrome about the centred gun" rather
            than its own section. */}
        <section className="mt-12 sm:mt-16 lg:mt-20" aria-label="Weapon meta">
          {/* Section eyebrow + heading mirroring the page header
              treatment, scaled down. Small enough to read as a
              secondary section, large enough to be a clear anchor. */}
          <div className="mb-4 sm:mb-6">
            <div className="flex items-center gap-3">
              <span aria-hidden className="block h-px w-8 bg-accent" />
              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-accent sm:text-xs">
                Meta
              </span>
            </div>
            <h2 className="mt-2 text-balance text-2xl font-extrabold leading-tight text-text sm:text-3xl lg:text-4xl">
              How the player base performs with each gun.
            </h2>
            <p className="mt-2 max-w-2xl text-xs text-text-muted sm:text-sm">
              Aggregated across every recorded match. Hover (or tap) a
              bubble to see the gun&apos;s name and stats.
            </p>
          </div>
          <WeaponMetaChart stats={usageStats} treeBranches={treeBranches} />
        </section>
      </Container>
    </main>
  );
}

/**
 * Rendered when fetch returned no usable weapons. Could be a transient
 * sheet outage or a misconfigured URL. We keep the message
 * non-alarming because the most likely cause is "the sheet is
 * temporarily unreachable" and a refresh will fix it.
 */
function EmptyState() {
  return (
    <div className="rounded-sm border border-border bg-bg-elevated p-8 text-center sm:p-12">
      <p className="text-base text-text-muted sm:text-lg">
        Weapons data is currently unavailable. Please try again shortly.
      </p>
    </div>
  );
}
