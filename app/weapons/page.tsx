import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { fetchWeapons, listGunTreeBranches } from "@/lib/cms/weapons";
import { WeaponsPageClient } from "@/components/weapons/WeaponsPageClient";

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
 * Empty / failure state: if the fetch fails or returns no rows,
 * we render a graceful message on the page rather than throwing.
 * The CMS fetch already returns [] for fetch failures — so empty
 * + failure look the same to this page.
 */

export const metadata: Metadata = {
  title: "Weapons — LaserOps Malta",
  description:
    "Explore LaserOps Malta's tactical weapons arsenal. Compare stats across 15+ guns, browse by gun tree, and see unlock paths.",
};

export default async function WeaponsPage() {
  const weapons = await fetchWeapons();
  const treeBranches = listGunTreeBranches(weapons);

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
