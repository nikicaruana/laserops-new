import type { ArmoryBranch, ArmoryEntry } from "@/lib/weapons/armory";
import { CollapsibleSection } from "@/components/portal/CollapsibleSection";
import { ArmoryCard } from "./ArmoryCard";
import { PlayerWeaponMetaChart } from "./PlayerWeaponMetaChart";
import { PlayerKillDistributionChart } from "./PlayerKillDistributionChart";

/**
 * PlayerArmoryView
 * --------------------------------------------------------------------
 * Top-level layout for the Armory page once a player is selected.
 * Above-the-fold:
 *   1. Per-player weapon-meta bubble chart
 *   2. Kill-distribution pie chart
 * Below-the-fold:
 *   - One CollapsibleSection per Gun_Tree_Branch (closed by default)
 *     with a responsive grid of ArmoryCard items.
 *
 * Server-renderable shell — only the cards, detail modals, and chart
 * client components need client-side state.
 */

type Props = {
  branches: ArmoryBranch[];
  ops: string;
};

export function PlayerArmoryView({ branches }: Props) {
  if (branches.length === 0) {
    return (
      <div className="mt-8 rounded-sm border border-dashed border-border bg-bg-elevated px-6 py-14 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">
          No armory data
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm text-text-muted">
          The Player_Armory sheet has no rows for this player yet.
          Once they play a match, their armory will populate here.
        </p>
      </div>
    );
  }

  // Flatten entries across all branches once for the charts. Both
  // chart components do their own filtering (used / unlocked /
  // kills > 0) so we hand them the full list and let them slice.
  const allEntries: ArmoryEntry[] = branches.flatMap((b) => b.entries);

  return (
    <div className="mt-8 flex flex-col gap-6 sm:gap-8">
      <div className="flex flex-col gap-6">
        {branches.map((branch) => (
          <CollapsibleSection
            key={branch.branch}
            title={branch.branch}
            defaultOpen={false}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {branch.entries.map((entry) => (
                <ArmoryCard
                  key={`${entry.gunName}-${entry.playerNickname}`}
                  entry={entry}
                />
              ))}
            </div>
          </CollapsibleSection>
        ))}
      </div>

      <PlayerWeaponMetaChart entries={allEntries} />
      <PlayerKillDistributionChart entries={allEntries} />
    </div>
  );
}
