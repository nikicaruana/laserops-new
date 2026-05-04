"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
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
      {/* Header: profile + nickname + CTA, centered at all breakpoints
          per design feedback. Photo doubles in size on desktop (w-24 →
          w-48) for visual presence; bracket-frame corners scaled up
          accordingly via two BracketFrame instances (mobile vs desktop)
          since the cornerSize prop isn't responsive itself. */}
      <header className="mb-5 flex flex-col items-center gap-3 sm:mb-6 sm:gap-4">
        <div className="sm:hidden">
          <BracketFrame cornerSize="0.875rem" thickness="2px" inset="-0.25rem">
            <img
              src={player.profilePicUrl}
              alt={`${player.nickname} profile photo`}
              loading="lazy"
              className="block aspect-square w-24 object-cover"
            />
          </BracketFrame>
        </div>
        <div className="hidden sm:block">
          <BracketFrame cornerSize="1.5rem" thickness="3px" inset="-0.4rem">
            <img
              src={player.profilePicUrl}
              alt={`${player.nickname} profile photo`}
              loading="lazy"
              className="block aspect-square w-48 object-cover"
            />
          </BracketFrame>
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-accent">
            Match Performance · #{player.scoreRank} on Score
          </p>
          <h2 className="text-2xl font-extrabold leading-tight text-text [overflow-wrap:anywhere] sm:text-3xl">
            {player.nickname}
          </h2>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em]">
            <TeamPill team={player.teamColor} />
            {/* Go-to-profile CTA — links to the player's full lifetime
                summary page. The Match Overview card already shows
                outcome via the winning team highlight, so we use this
                slot for an action instead of a redundant Winner/Loser
                pill. */}
            <Link
              href={`/player-portal/player-stats/summary?ops=${encodeURIComponent(player.nickname)}`}
              className={cn(
                "inline-flex items-center gap-1 px-3 py-1 rounded-sm",
                "bg-accent text-bg",
                "transition-colors hover:bg-accent-soft",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              )}
            >
              Go To Profile
              <span aria-hidden className="text-xs">→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* XP card + Gun used card.
          Mobile: stacked, XP first then gun.
          Desktop: side-by-side via grid. XP card grows to fill (1fr),
          gun card fixed at 280px on the right. The shorter XP card width
          means the progress bar is naturally shorter, which the user
          asked for.
          `items-start` so each card sits at its natural height — without
          this, the grid would stretch the shorter card to match the
          taller one, leaving awkward empty space below. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-5">
        <XpCard player={player} ranks={ranks} />
        <GunUsedCard
          weaponName={player.gunUsed}
          imageUrl={player.gunUsedImage}
        />
      </div>

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

      {/* Accolades earned. Dark backdrop (was yellow): the badge
          artwork is yellow-themed so it pops on black. The dark inset
          boxes that used to wrap each badge for contrast on yellow
          aren't needed anymore — black-on-yellow-art reads cleanly
          without any wrapper. */}
      {player.earnedAccolades.length > 0 && (
        <div className="mt-6 rounded-sm border border-border bg-bg-elevated px-5 py-5 text-text sm:mt-8 sm:px-6 sm:py-6">
          <h3 className="text-center text-base font-extrabold uppercase tracking-[0.16em] sm:text-lg">
            Accolades Earned
          </h3>
          <div className="mt-5 grid grid-cols-3 gap-x-4 gap-y-2 sm:grid-cols-4 sm:gap-5 lg:grid-cols-5">
            {player.earnedAccolades.map(({ accolade }) => (
              <AccoladeTile key={accolade.key} accolade={accolade} />
            ))}
          </div>
          <p className="mt-5 text-center text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
            Tap an accolade to see what it means
          </p>
        </div>
      )}
    </section>
  );
}

/* ---------- Gun used card ---------- */

/**
 * GunUsedCard — at this point a single yellow tile holding the gun
 * silhouette + weapon name. The dark "GUN USED" eyebrow + wrapper
 * card was dropped after iterations because:
 *   - At 280px column width sitting next to the XP card, the eyebrow
 *     strip + wrapper padding pushed the card noticeably taller than
 *     the XP card, leaving awkward empty space below the XP card.
 *   - The card identity ("this is the gun used") is communicated by
 *     the visual itself — a yellow tile with a gun image is
 *     recognisable. The eyebrow text was redundant.
 * If we ever need the eyebrow back (e.g. when this card is used in
 * a different context with less surrounding context), wrap this in a
 * card-style component again.
 */
function GunUsedCard({
  weaponName,
  imageUrl,
}: {
  weaponName: string;
  imageUrl: string;
}) {
  if (weaponName === "" && imageUrl === "") return null;

  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-sm bg-accent px-3 py-3 text-bg sm:px-4 sm:py-4">
      {imageUrl !== "" ? (
        <img
          src={imageUrl}
          alt={weaponName}
          loading="lazy"
          decoding="async"
          className="block h-auto max-h-[80px] w-full object-contain sm:max-h-[100px]"
        />
      ) : (
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-bg/70">
          No image
        </span>
      )}
      <p className="text-center text-sm font-extrabold tracking-tight sm:text-base">
        {weaponName || "Unknown gun"}
      </p>
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
