"use client";

import { useEffect, useRef } from "react";
import type { MatchPlayer } from "@/lib/match-report/engine";
import type { RankLevel } from "@/lib/cms/ranking-system";
import { XpCard } from "./XpCard";
import { AnimatedNumber } from "./AnimatedNumber";
import { AccoladeTile } from "./AccoladeTile";
import { BracketFrame } from "@/components/portal/BracketFrame";
import { cn } from "@/lib/cn";

/**
 * PlayerStatsCard
 * --------------------------------------------------------------------
 * The expanded view that appears below the players table when a player
 * is clicked. Match-scoped (NOT lifetime) — these are all stats for
 * THIS match only.
 *
 * Client component for two reasons:
 *   - On mount, scrolls itself into view smoothly. Without this, when
 *     a user clicks a row in the players table, the URL changes and
 *     the card renders below — but the user is still scrolled at the
 *     top, and might not realise the card appeared further down.
 *   - The stat tiles use AnimatedNumber for a "count up from 0" effect
 *     when the player changes.
 *
 * Layout:
 *   - Top section: profile + identity + (XP card with animation)
 *   - Stat grid: 6 stats with rank-within-match
 *   - Accolades section: only the ones earned in THIS match,
 *     showing definition + XP value
 */

type Props = {
  player: MatchPlayer;
  ranks: RankLevel[];
};

export function PlayerStatsCard({ player, ranks }: Props) {
  const sectionRef = useRef<HTMLElement>(null);

  // Scroll into view when the player changes. Smooth scroll so it
  // doesn't feel jarring; offset slightly from the top so the card
  // doesn't sit flush against the navbar.
  // We re-scroll on every player change (key in the dependency list)
  // so clicking a different row in the table jumps to the new card.
  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    // Use rAF so the scroll happens after the browser has laid out the
    // newly-mounted card; otherwise scrollIntoView can land before the
    // layout settles and undershoot.
    const id = window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [player.nickname]);

  return (
    <section
      ref={sectionRef}
      aria-label={`${player.nickname} match performance`}
      className="rounded-sm border border-accent bg-bg-elevated p-5 sm:p-7"
      // scroll-mt offsets the scroll-into-view target so the section
      // doesn't sit flush against the top of the viewport.
      style={{ scrollMarginTop: "5rem" }}
    >
      {/* Header: profile + nickname + team treatment */}
      <header className="mb-5 flex flex-col items-center gap-3 sm:mb-6 sm:flex-row sm:gap-5">
        <BracketFrame cornerSize="0.875rem" thickness="2px" inset="-0.25rem">
          <img
            src={player.profilePicUrl}
            alt={`${player.nickname} profile photo`}
            loading="lazy"
            className="block aspect-square w-20 object-cover sm:w-24"
          />
        </BracketFrame>
        <div className="flex flex-1 flex-col items-center gap-1 sm:items-start">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-accent">
            Match Performance · #{player.scoreRank} on Score
          </p>
          <h2 className="text-2xl font-extrabold leading-tight text-text [overflow-wrap:anywhere] sm:text-3xl">
            {player.nickname}
          </h2>
          <div className="mt-1 flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em]">
            <TeamPill team={player.teamColor} />
            <span
              className={cn(
                "px-2 py-1 rounded-sm",
                player.isWinner
                  ? "bg-accent text-bg"
                  : "border border-border-strong text-text-muted",
              )}
            >
              {player.isWinner ? "Winner" : "Loser"}
            </span>
          </div>
        </div>
      </header>

      {/* XP card with animations */}
      <XpCard player={player} ranks={ranks} />

      {/* Gun used card — same visual treatment as the FavouriteWeapon
          card on the player summary page (yellow tile housing the gun
          art, label below). The gun used is per-match here vs lifetime
          there, but the visual treatment is identical so the user
          recognises the card type instantly. */}
      <GunUsedCard
        weaponName={player.gunUsed}
        imageUrl={player.gunUsedImage}
      />

      {/* Stat grid — match-scoped values + per-match ranks. AnimatedNumber
          counts up from 0 to final value on player change. The `key` on
          each tile uses the player's nickname so React unmounts/remounts
          the AnimatedNumber when the player changes, restarting the
          animation. */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
        <StatTile
          key={`${player.nickname}-score`}
          label="Score"
          value={player.score}
          format="comma"
          rank={player.scoreRank}
        />
        <StatTile
          key={`${player.nickname}-kills`}
          label="Kills"
          value={player.kills}
          format="int"
          rank={player.killsRank}
        />
        <StatTile
          key={`${player.nickname}-deaths`}
          label="Deaths"
          value={player.deaths}
          format="int"
          rank={player.deathsRank}
        />
        <StatTile
          key={`${player.nickname}-kd`}
          label="K/D"
          value={player.kd}
          format="float"
          rank={player.kdRank}
        />
        <StatTile
          key={`${player.nickname}-damage`}
          label="Damage"
          value={player.damage}
          format="comma"
          rank={player.damageRank}
        />
        <StatTile
          key={`${player.nickname}-acc`}
          label="Accuracy"
          value={player.accuracy * 100}
          format="percent"
          rank={player.accuracyRank}
        />
      </div>

      {/* Accolades earned (only those with value 1 in the data). Each
          tile is interactive — tap to reveal the accolade's description
          in a popover. The tile itself shows just the badge + XP label
          since the badge image already includes the accolade name. */}
      {player.earnedAccolades.length > 0 && (
        <div className="mt-6 rounded-sm bg-accent px-5 py-5 text-bg sm:mt-8 sm:px-6 sm:py-6">
          <h3 className="text-center text-base font-extrabold uppercase tracking-[0.16em] sm:text-lg">
            Accolades Earned
          </h3>
          <div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-4 sm:gap-5 lg:grid-cols-5">
            {player.earnedAccolades.map(({ accolade }) => (
              <AccoladeTile key={accolade.key} accolade={accolade} />
            ))}
          </div>
          <p className="mt-4 text-center text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-bg/70">
            Tap an accolade to see what it means
          </p>
        </div>
      )}
    </section>
  );
}

/* ---------- Gun used card ---------- */

/**
 * GunUsedCard — mirrors the FavouriteWeaponCard's visual treatment from
 * the player summary page so the visual language stays consistent. Per-
 * match here (vs lifetime there) but the design intent is identical:
 * a yellow tile that gives the dark gun silhouette artwork enough
 * contrast to read clearly.
 *
 * Sits below the XP card in the player stats section. Spans the full
 * width of the card on mobile; on desktop, sized as a single column
 * but inside the existing flow.
 */
function GunUsedCard({
  weaponName,
  imageUrl,
}: {
  weaponName: string;
  imageUrl: string;
}) {
  // No gun data at all → don't render the card. We don't want an empty
  // "GUN USED" tile cluttering the layout.
  if (weaponName === "" && imageUrl === "") return null;

  return (
    <div className="mt-6 flex flex-col gap-3 border border-border bg-bg-elevated p-4 sm:p-6">
      <div className="text-center text-[0.65rem] font-bold uppercase tracking-[0.14em] text-text-muted">
        Gun Used
      </div>

      <div className="flex items-center justify-center bg-accent px-4 py-6 sm:px-6 sm:py-8 min-h-[140px] sm:min-h-[180px]">
        {imageUrl !== "" ? (
          <img
            src={imageUrl}
            alt={weaponName}
            loading="lazy"
            decoding="async"
            className="h-full max-h-full w-full object-contain"
          />
        ) : (
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-bg/70">
            No image
          </span>
        )}
      </div>

      <div className="text-center text-base font-bold tracking-tight text-text sm:text-lg">
        {weaponName || "Unknown gun"}
      </div>
    </div>
  );
}

/* ---------- Tile components ---------- */

type FormatKind = "int" | "float" | "comma" | "percent";

function StatTile({
  label,
  value,
  format,
  rank,
}: {
  label: string;
  value: number;
  format: FormatKind;
  rank: number;
}) {
  return (
    // Vertical layout: label + value centered as a unit, then rank
    // pinned bottom-left. flex-col with the rank pushed down via
    // mt-auto so it sits at the bottom even when the card is taller
    // than its content (e.g. neighbouring cards drive height).
    <div className="flex flex-col rounded-sm bg-accent px-3 py-3 text-bg sm:px-4 sm:py-4">
      <p className="text-center text-xs font-extrabold uppercase tracking-[0.14em] sm:text-sm">
        {label}
      </p>
      <p className="mt-1 text-center font-mono text-2xl font-bold tabular-nums sm:text-3xl">
        <AnimatedNumber value={value} format={format} />
      </p>
      {rank > 0 && (
        <p className="mt-auto pt-2 text-left text-[0.6rem] font-semibold uppercase tracking-[0.14em]">
          Rank: #{rank}
        </p>
      )}
    </div>
  );
}

function TeamPill({ team }: { team: string }) {
  const colorLower = team.toLowerCase();
  return (
    <span
      className={cn(
        "px-2 py-1 rounded-sm border",
        colorLower === "blue" && "border-blue-400 text-blue-400",
        colorLower === "red" && "border-red-400 text-red-400",
        colorLower === "yellow" && "border-accent text-accent",
        !["blue", "red", "yellow"].includes(colorLower) && "border-border-strong text-text-muted",
      )}
    >
      {team || "—"}
    </span>
  );
}
