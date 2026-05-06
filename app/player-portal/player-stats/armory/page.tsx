import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardPageHeader } from "@/components/portal/DashboardPageHeader";
import { ArmoryEmptyState } from "@/components/portal/player-armory/ArmoryEmptyState";
import { PlayerArmoryView } from "@/components/portal/player-armory/PlayerArmoryView";
import {
  fetchPlayerArmory,
  filterPlayerArmoryByOps,
} from "@/lib/cms/player-armory";
import { fetchWeapons } from "@/lib/cms/weapons";
import { buildPlayerArmory } from "@/lib/weapons/armory";

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
 * The PlayerSearch bar lives in the player-stats layout (PlayerStatsShell),
 * so it appears above the sub-tabs for all player-stats pages — no separate
 * search bar here.
 */

type SearchParams = Promise<{ ops?: string }>;

export default async function PlayerArmoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const ops = (params.ops ?? "").trim();

  return (
    <div className="mx-auto w-full max-w-5xl">
      <DashboardPageHeader title="Personal Armory" hideAddToHome />

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
          Ops Tag — recent players appear in the search bar above.
        </p>
      </div>
    );
  }

  const branches = buildPlayerArmory(filtered, weapons);

  return <PlayerArmoryView branches={branches} ops={ops} />;
}
