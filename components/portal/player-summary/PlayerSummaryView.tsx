"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  findPlayerByOpsTag,
  type PlayerStatsRaw,
} from "@/lib/player-stats/shared";
import { projectSummaryTop } from "@/lib/player-stats/summary-top";
// PlayerSearch and PlayerSearchAutoload live in PlayerStatsShell (layout level)
// so the search bar appears above the sub-tabs for all player-stats pages.
import { ProfileCard } from "@/components/portal/player-summary/ProfileCard";
import { LevelCard } from "@/components/portal/player-summary/LevelCard";
import { FavouriteWeaponCard } from "@/components/portal/player-summary/FavouriteWeaponCard";
import { StatsSection } from "@/components/portal/player-summary/StatsSection";
import { AccoladesSection } from "@/components/portal/player-summary/AccoladesSection";
import { CollapsibleSection } from "@/components/portal/CollapsibleSection";

/** Same key as PlayerSearch — kept in sync to keep the autoload-then-clear flow honest. */
const LOCALSTORAGE_KEY = "laserops:last-ops-tag";

/**
 * PlayerSummaryView
 * --------------------------------------------------------------------
 * Client orchestrator for the Player Summary page's top section.
 *
 * Receives ALL player rows from the server (cached fetch) and:
 *   - Reads ?ops= from the URL to determine which player to show
 *   - Renders the search input (with the full nickname list for autocomplete)
 *   - Renders the empty/found state below
 *   - On first render with no ?ops= param, attempts localStorage autoload
 *     via the PlayerSearchAutoload helper (no-op if no saved tag)
 *
 * Stats and Accolades sections will be added below in future drops; the
 * pattern stays the same — they read the same selected player from URL.
 *
 * Why client-side selection: the search input and URL-driven filtering
 * both want React state for instant feedback. The data shipping cost is
 * minimal — Player_Stats is one row per player, ~80 columns of text/numbers,
 * roughly 50-100KB of JSON for a few hundred players. Trivial.
 */

type PlayerSummaryViewProps = {
  allRows: PlayerStatsRaw[];
};

export function PlayerSummaryView({ allRows }: PlayerSummaryViewProps) {
  const searchParams = useSearchParams();
  const opsParam = searchParams.get("ops") ?? "";

  // Look up the selected player from the URL param. undefined if no match.
  const player = useMemo(
    () => (opsParam ? findPlayerByOpsTag(allRows, opsParam) : undefined),
    [allRows, opsParam],
  );

  // Project the player into the top-section's typed shape. Memoised so we
  // don't recompute on unrelated re-renders.
  const top = useMemo(
    () => (player ? projectSummaryTop(player) : null),
    [player],
  );

  // If the URL is pointing at a player that doesn't exist in the data,
  // clear localStorage so the next visit doesn't auto-redirect to the
  // same dead player. We don't clear on empty URL — only when ?ops= is
  // set but the lookup failed.
  useEffect(() => {
    if (opsParam !== "" && !player) {
      try {
        // Only clear if the saved value matches the bad URL — don't trash
        // a different valid saved tag if the user just typed a typo.
        const saved = localStorage.getItem(LOCALSTORAGE_KEY);
        if (saved && saved.toLowerCase() === opsParam.toLowerCase()) {
          localStorage.removeItem(LOCALSTORAGE_KEY);
        }
      } catch {
        // ignore
      }
    }
  }, [opsParam, player]);

  return (
    <>
      {/* States:
          1. URL has no ?ops= and no autoload happened → show empty hint
          2. URL has ?ops= but no match in data → show "not found" hint
          3. URL has ?ops= and match found → show the cards + Stats section
        */}
      {opsParam === "" && <SearchPrompt />}
      {opsParam !== "" && !player && <PlayerNotFound opsTag={opsParam} />}
      {top && player && (
        <>
          <TopSection top={top} />
          {/* Stats section sits below the top cards, collapsible. Spacing
              top-margin comes from the section's natural <details> margin
              plus our wrapper. */}
          <div className="mt-2">
            <CollapsibleSection title="Stats">
              <StatsSection row={player} />
            </CollapsibleSection>
          </div>
          {/* Accolades section — same collapsible pattern, sits below Stats.
              Has its own internal tier subsections and definitions list. */}
          <CollapsibleSection title="Accolades">
            <AccoladesSection row={player} />
          </CollapsibleSection>
        </>
      )}
    </>
  );
}

/* ---------- States ---------- */

function SearchPrompt() {
  return (
    <div className="border border-border bg-bg-elevated px-6 py-12 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
        Enter your ops tag to view stats
      </p>
      <p className="mt-2 text-sm text-text-subtle">
        Start typing in the search field above — suggestions will appear.
      </p>
    </div>
  );
}

function PlayerNotFound({ opsTag }: { opsTag: string }) {
  return (
    <div className="border border-border bg-bg-elevated px-6 py-12 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
        Player not found
      </p>
      <p className="mt-2 text-sm text-text-subtle">
        No player matches &ldquo;{opsTag}&rdquo;. Check the spelling or pick from
        the suggestions in the search field.
      </p>
    </div>
  );
}

/* ---------- Composed top section ---------- */

function TopSection({ top }: { top: ReturnType<typeof projectSummaryTop> }) {
  return (
    // Desktop: 5/12 + 7/12 split (profile | right column).
    // Profile photo card needs less width than the level/weapon stack.
    // Mobile: stacks vertically, profile first.
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-12 sm:gap-5">
      <div className="sm:col-span-5">
        <ProfileCard
          nickname={top.nickname}
          profilePicUrl={top.profilePicUrl}
          overallRatingImageUrl={top.overallRatingImageUrl}
          ratingUnlocked={top.ratingUnlocked}
        />
      </div>
      <div className="flex flex-col gap-4 sm:col-span-7 sm:gap-5">
        <LevelCard
          rankBadgeUrl={top.rankBadgeUrl}
          levelDisplay={top.levelDisplay}
          matchesPlayed={top.matchesPlayed}
          totalXp={top.totalXp}
          levelProgressPct={top.levelProgressPct}
        />
        <FavouriteWeaponCard
          weaponName={top.favouriteGun}
          imageUrl={top.favouriteGunImageUrl}
        />
      </div>
    </div>
  );
}
