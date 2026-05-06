import type { ArmoryBranch } from "@/lib/weapons/armory";
import { CollapsibleSection } from "@/components/portal/CollapsibleSection";
import { ArmoryCard } from "./ArmoryCard";

/**
 * PlayerArmoryView
 * --------------------------------------------------------------------
 * Top-level layout for the Armory page once a player is selected.
 * Renders one CollapsibleSection per Gun_Tree_Branch, each containing
 * a responsive grid of ArmoryCard items.
 *
 * Server-renderable shell — only the cards (and their detail modals)
 * need client-side state.
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

  return (
    <div className="mt-8 flex flex-col gap-6">
      {branches.map((branch) => (
        <CollapsibleSection key={branch.branch} title={branch.branch}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
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
  );
}
