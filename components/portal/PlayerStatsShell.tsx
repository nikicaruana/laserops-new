"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  PlayerSearch,
  PlayerSearchAutoload,
} from "@/components/portal/player-summary/PlayerSearch";
import { SubTabs } from "@/components/portal/SubTabs";

/**
 * PlayerStatsShell
 * --------------------------------------------------------------------
 * Client wrapper for the entire /player-portal/player-stats section.
 *
 * Rendered by the player-stats layout (which is a server component that
 * fetches knownNicknames once, cached). This shell:
 *
 *   1. Reads the current ?ops= param to know which player is selected.
 *   2. Renders the PlayerSearch bar at the top — always visible, giving
 *      the impression "search first, then browse tabs below".
 *   3. Renders the SubTabs row (Summary / History / Armory / Last Match)
 *      only once a player is selected — tabs are meaningless without a
 *      player context.
 *   4. Handles localStorage auto-load (PlayerSearchAutoload) so returning
 *      visitors land on their last-viewed player automatically.
 *
 * The inner component uses useSearchParams (CSR bailout hook) so it must
 * sit behind a Suspense boundary. The fallback renders the page content
 * without search bar or tabs — correct for static prerender since the URL
 * isn't known at build time.
 */

const PLAYER_STATS_TABS = [
  { label: "Summary", href: "/player-portal/player-stats/summary" },
  { label: "History", href: "/player-portal/player-stats/history" },
  { label: "Armory", href: "/player-portal/player-stats/armory" },
  { label: "Last Match", href: "/player-portal/player-stats/last-match" },
];

type Props = {
  knownNicknames: string[];
  children: React.ReactNode;
};

export function PlayerStatsShell({ knownNicknames, children }: Props) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
          {children}
        </div>
      }
    >
      <PlayerStatsShellInner knownNicknames={knownNicknames}>
        {children}
      </PlayerStatsShellInner>
    </Suspense>
  );
}

function PlayerStatsShellInner({ knownNicknames, children }: Props) {
  const searchParams = useSearchParams();
  const opsParam = searchParams.get("ops") ?? "";
  const hasPlayer = opsParam !== "";

  return (
    <>
      {/* Auto-load the last-viewed player from localStorage if URL has no
          ?ops= param. Runs for every player-stats sub-page. */}
      <PlayerSearchAutoload hasOpsParam={hasPlayer} />

      {/* Search bar — always shown; visually above the sub-tabs so the
          user understands they pick a player first. */}
      <div className="border-b border-border bg-bg">
        <div className="mx-auto w-full max-w-[90rem] px-4 py-3 sm:px-8 lg:px-12">
          {/* On desktop the full-width search bar looks disproportionately
              large — cap it so it reads as a compact input, not a hero form. */}
          <div className="sm:mx-auto sm:max-w-xs">
            <PlayerSearch knownNicknames={knownNicknames} currentOpsTag={opsParam} />
          </div>
        </div>
      </div>

      {/* Sub-tabs — only once a player is selected */}
      {hasPlayer && (
        <SubTabs tabs={PLAYER_STATS_TABS} forwardParams={["ops"]} />
      )}

      {/* Page content */}
      <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
        {children}
      </div>
    </>
  );
}
