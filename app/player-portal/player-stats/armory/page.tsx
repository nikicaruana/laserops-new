import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardPageHeader } from "@/components/portal/DashboardPageHeader";
import { PlayerSearch } from "@/components/portal/player-summary/PlayerSearch";
import { ArmoryEmptyState } from "@/components/portal/player-armory/ArmoryEmptyState";
import { PlayerArmoryView } from "@/components/portal/player-armory/PlayerArmoryView";
import {
  fetchPlayerArmory,
  filterPlayerArmoryByOps,
} from "@/lib/cms/player-armory";
import { fetchWeapons } from "@/lib/cms/weapons";
import { buildPlayerArmory } from "@/lib/weapons/armory";
import {
  fetchAllPlayerStats,
  listAllNicknames,
} from "@/lib/player-stats/shared";

export const metadata: Metadata = {
  title: "Armory",
};

/**
 * Player Armory page.
 *
 * URL state: ?ops=<OpsTag>. When present, server fetches that player's
 * armory rows from the Player_Armory_Public sheet, joins to the static
 * Gun_Damage catalogue for spec extras, groups by Gun_Tree_Branch, and
 * renders one collapsible section per branch with ArmoryCard items.
 *
 * Mirrors the History page's pattern: nickname autocomplete is fetched
 * in the outer page so the search bar is always available; the heavier
 * per-player data is loaded inside a Suspense boundary keyed on `ops`
 * so switching players triggers a fresh fetch + suspense fallback.
 */

type SearchParams = Promise<{ ops?: string }>;

export default async function PlayerArmoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const ops = (params.ops ?? "").trim();

  const knownPlayersResult = await fetchAllPlayerStats();
  const knownNicknames = knownPlayersResult.ok
    ? listAllNicknames(knownPlayersResult.rows)
    : [];

  return (
    <div className="mx-auto w-full max-w-5xl">
      <DashboardPageHeader title="Armory" hideAddToHome />

      <Suspense fallback={null}>
        <PlayerSearch knownNicknames={knownNicknames} currentOpsTag={ops} />
      </Suspense>

      {ops === "" ? (
        <ArmoryEmptyState />
      ) : (
        <Suspense
          key={ops}
          fallback={
            <div className="mt-8 border border-border bg-bg-elevated px-6 py-16 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
                Loading armory…
              </p>
            </div>
          }
        >
          <ArmoryContent ops={ops} />
        </Suspense>
      )}
    </div>
  );
}

async function ArmoryContent({ ops }: { ops: string }) {
  const [armoryRows, weapons] = await Promise.all([
    fetchPlayerArmory(),
    fetchWeapons(),
  ]);

  const filtered = filterPlayerArmoryByOps(armoryRows, ops);

  if (filtered.length === 0) {
    return (
      <div className="mt-8 border border-dashed border-border bg-bg-elevated px-6 py-14 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">
          Player Not Found
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm text-text-muted sm:text-base">
          No armory data for &ldquo;{ops}&rdquo; yet. Double-check the
          Ops Tag — recent players appear in the search dropdown above.
        </p>
      </div>
    );
  }

  const branches = buildPlayerArmory(filtered, weapons);

  return <PlayerArmoryView branches={branches} ops={ops} />;
}
