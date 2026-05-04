"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MatchPlayer } from "@/lib/match-report/engine";
import { cn } from "@/lib/cn";

/**
 * PlayersTable
 * --------------------------------------------------------------------
 * Match-specific player table. Bespoke (not LeaderboardTable) because
 * it has different ergonomics requirements:
 *
 *   - Horizontal scroll on mobile, with the # + Ops Tag columns
 *     frozen on the left so the player's identity stays visible while
 *     they scroll through the metrics.
 *   - Best-in-row highlighting: the row with the best value in each
 *     metric column gets that cell tinted yellow. "Best" means highest
 *     for most metrics, lowest for Deaths.
 *   - Compact cells (no profile pic) — the page already has a lot of
 *     visual content; the table is meant to be scannable, not pretty.
 *
 * Native <table> with `position: sticky; left: 0;` on the # / Ops Tag
 * cells is the tidiest way to do sticky columns. The wrapping div
 * has overflow-x: auto for the scroll, and the table sets a min-width
 * so it always exceeds the container width on small viewports.
 */

type Props = {
  players: MatchPlayer[];
  matchId: string;
  selectedPlayer: string;
};

/**
 * Per-metric "best value" — used to tint the winning cell yellow.
 * For Deaths, lower is better. For everything else, higher.
 *
 * Pre-compute once per render rather than recomputing per cell.
 *
 * `scoreByGun` is a separate per-gun-best Score map so the table
 * can highlight EVERY gun's specialist (the highest scorer with that
 * particular weapon), not just the absolute top scorer. This adds
 * extra "yellow" cells for the Score column without affecting other
 * columns. Empty/blank gun strings are excluded (no point grouping
 * unknowns).
 */
type BestValues = {
  score: number;
  kills: number;
  deaths: number;
  kd: number;
  accuracy: number;
  damage: number;
  totalXp: number;
  scoreByGun: Map<string, number>;
};

function computeBestValues(players: MatchPlayer[]): BestValues {
  if (players.length === 0) {
    return {
      score: 0, kills: 0, deaths: 0, kd: 0, accuracy: 0, damage: 0, totalXp: 0,
      scoreByGun: new Map(),
    };
  }

  const scoreByGun = new Map<string, number>();
  for (const p of players) {
    const gun = p.gunUsed.trim();
    if (gun === "") continue;
    const prev = scoreByGun.get(gun) ?? -Infinity;
    if (p.score > prev) scoreByGun.set(gun, p.score);
  }

  return {
    score: Math.max(...players.map((p) => p.score)),
    kills: Math.max(...players.map((p) => p.kills)),
    deaths: Math.min(...players.map((p) => p.deaths)),
    kd: Math.max(...players.map((p) => p.kd)),
    accuracy: Math.max(...players.map((p) => p.accuracy)),
    damage: Math.max(...players.map((p) => p.damage)),
    totalXp: Math.max(...players.map((p) => p.totalXp)),
    scoreByGun,
  };
}

export function PlayersTable({ players, matchId, selectedPlayer }: Props) {
  const pathname = usePathname();
  const best = useMemo(() => computeBestValues(players), [players]);
  const selectedLower = selectedPlayer.toLowerCase();

  return (
    <div className="border border-border bg-bg-elevated">
      {/* Yellow accent strip at top — matches LeaderboardTable styling */}
      <div aria-hidden className="h-1 w-full bg-accent" />

      <div
        className="overflow-x-auto"
        // Custom scrollbar styling for an "intentional" feel — fine to
        // leave default if you'd rather; this is just a polish touch.
        style={{ scrollbarWidth: "thin" }}
      >
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border-strong bg-bg-overlay">
              {/* Rank column. Explicit width so it matches the
                  Ops Tag column's sticky `left` offset exactly — no gap
                  between them when scrolling. */}
              <Th align="center" sticky="rank">
                #
              </Th>
              <Th align="center" sticky="ops">
                Ops Tag
              </Th>
              <Th align="center">Lvl</Th>
              <Th align="center">Team</Th>
              <Th align="left">Gun</Th>
              <Th align="right">Score</Th>
              <Th align="right">Kills</Th>
              <Th align="right">Deaths</Th>
              <Th align="right">KD</Th>
              <Th align="right">Acc</Th>
              <Th align="right">Damage</Th>
              <Th align="right">Total XP</Th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, idx) => {
              const isSelected = p.nickname.toLowerCase() === selectedLower;
              const href = `${pathname}?match=${encodeURIComponent(
                matchId,
              )}&player=${encodeURIComponent(p.nickname)}`;
              return (
                <PlayerRow
                  key={p.nickname}
                  player={p}
                  rank={idx + 1}
                  isSelected={isSelected}
                  href={href}
                  best={best}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Header cell ---------- */

function Th({
  children,
  align,
  sticky,
}: {
  children: React.ReactNode;
  align: "left" | "center" | "right";
  sticky?: "rank" | "ops";
}) {
  return (
    <th
      className={cn(
        // Base typography for column headers
        "py-2.5 text-[0.55rem] font-bold uppercase tracking-[0.12em] text-text-muted sm:text-[0.65rem] sm:tracking-[0.16em]",
        "whitespace-nowrap",
        align === "left" && "text-left",
        align === "center" && "text-center",
        align === "right" && "text-right",
        // Default padding for non-sticky cells
        !sticky && "px-3",
        // Sticky: explicit widths matching the left-offsets used below
        // for the ops column. The rank column is w-9 (mobile) / w-12
        // (desktop) — exactly equal to where the ops column starts —
        // so they butt up against each other with no gap.
        sticky === "rank" &&
          "sticky left-0 z-10 w-9 min-w-9 bg-bg-overlay sm:w-12 sm:min-w-12",
        sticky === "ops" &&
          "sticky left-9 z-10 bg-bg-overlay px-2 sm:left-12 sm:px-3",
      )}
    >
      {children}
    </th>
  );
}

/* ---------- Player row ---------- */

function PlayerRow({
  player,
  rank,
  isSelected,
  href,
  best,
}: {
  player: MatchPlayer;
  rank: number;
  isSelected: boolean;
  href: string;
  best: BestValues;
}) {
  const rowBg = isSelected ? "bg-accent/[0.06]" : "bg-bg-elevated";
  const stickyBg = isSelected ? "bg-bg-elevated" : "bg-bg-elevated";
  // ^ even when row is "selected" (subtle yellow tint), the sticky
  //   columns need to be FULLY opaque or other cells will bleed through
  //   when scrolled. So sticky bg uses solid bg-bg-elevated regardless.

  return (
    <tr
      className={cn(
        "border-b border-border/60 last:border-b-0",
        rowBg,
        // Hover treatment — applies via the Link inside, but we add a
        // row-level class so the hover state on any cell triggers it.
        "transition-colors hover:bg-bg-overlay/40",
      )}
    >
      {/* Rank — clickable, sticky. Explicit width matching the ops
          column's left-offset so the two sit flush, no gap. */}
      <td
        className={cn(
          "sticky left-0 z-[1] w-9 min-w-9 py-3 text-center sm:w-12 sm:min-w-12",
          stickyBg,
        )}
      >
        <RowLink href={href} ariaLabel={`View ${player.nickname}'s match stats`}>
          <span
            className={cn(
              "block font-mono text-[0.6rem] font-bold sm:text-xs",
              rank === 1 ? "text-accent" : "text-text-subtle",
            )}
          >
            {String(rank).padStart(2, "0")}
          </span>
        </RowLink>
      </td>

      {/* Ops Tag — clickable, sticky, the "frozen" identity column.
          Center-aligned per design feedback: the rank column is also
          centered, so the two sticky columns read as a unified
          identity block. */}
      <td
        className={cn(
          "sticky left-9 z-[1] py-3 px-2 text-center sm:left-12 sm:px-3",
          stickyBg,
          // Right-edge gradient hint that content scrolls under the
          // sticky column.
          "after:absolute after:right-0 after:top-0 after:h-full after:w-3 after:bg-gradient-to-r after:from-bg-elevated after:to-transparent after:pointer-events-none",
        )}
      >
        <RowLink href={href} ariaLabel={`View ${player.nickname}'s match stats`}>
          <span
            className={cn(
              "mx-auto block max-w-[8rem] truncate text-xs font-semibold leading-tight [overflow-wrap:anywhere] sm:max-w-[10rem] sm:text-sm",
              isSelected ? "text-accent" : "text-text",
            )}
          >
            {player.nickname}
          </span>
        </RowLink>
      </td>

      {/* Scrollable content cells. Each is wrapped in a RowLink so the
          entire row is one big tap target — clicking anywhere navigates. */}
      <Td align="center">
        <RowLink href={href}>{player.level || "—"}</RowLink>
      </Td>

      <Td align="center">
        <RowLink href={href}>
          <span
            className={cn(
              "text-[0.6rem] font-bold uppercase tracking-[0.1em]",
              player.teamColorLower === "blue" && "text-blue-400",
              player.teamColorLower === "red" && "text-red-400",
              player.teamColorLower === "yellow" && "text-accent",
            )}
          >
            {player.teamColor || "—"}
          </span>
        </RowLink>
      </Td>

      <Td align="left">
        <RowLink href={href}>
          <span className="block max-w-[7rem] truncate text-[0.65rem] text-text-muted sm:max-w-[10rem] sm:text-xs">
            {player.gunUsed || "—"}
          </span>
        </RowLink>
      </Td>

      <BestTd
        value={player.score}
        best={best.score}
        format="number"
        // Score column is special: ALSO highlight if this player is
        // the top scorer with their specific gun. Each "gun specialist"
        // (top scorer with a given weapon) gets their Score cell tinted
        // yellow, on top of the absolute-best highlight.
        extraHighlight={
          player.gunUsed !== "" &&
          best.scoreByGun.get(player.gunUsed) === player.score
        }
      >
        <RowLink href={href}>{player.score.toLocaleString("en-US")}</RowLink>
      </BestTd>

      <BestTd value={player.kills} best={best.kills} format="number">
        <RowLink href={href}>{player.kills}</RowLink>
      </BestTd>

      <BestTd value={player.deaths} best={best.deaths} format="number">
        <RowLink href={href}>{player.deaths}</RowLink>
      </BestTd>

      <BestTd value={player.kd} best={best.kd} format="kd">
        <RowLink href={href}>{player.kd.toFixed(2)}</RowLink>
      </BestTd>

      <BestTd value={player.accuracy} best={best.accuracy} format="percent">
        <RowLink href={href}>{`${Math.round(player.accuracy * 100)}%`}</RowLink>
      </BestTd>

      <BestTd value={player.damage} best={best.damage} format="number">
        <RowLink href={href}>{player.damage.toLocaleString("en-US")}</RowLink>
      </BestTd>

      <BestTd value={player.totalXp} best={best.totalXp} format="number">
        <RowLink href={href}>{player.totalXp.toLocaleString("en-US")}</RowLink>
      </BestTd>
    </tr>
  );
}

/* ---------- Td variants ---------- */

function Td({
  children,
  align,
}: {
  children: React.ReactNode;
  align: "left" | "center" | "right";
}) {
  return (
    <td
      className={cn(
        "px-3 py-3 text-xs sm:text-sm",
        align === "left" && "text-left",
        align === "center" && "text-center",
        align === "right" && "text-right font-mono tabular-nums",
      )}
    >
      {children}
    </td>
  );
}

/**
 * Td with "best value" highlighting. If this cell's value matches the
 * computed best for the column, the cell tints yellow.
 *
 * `extraHighlight` is an OR — if true, the cell highlights even if the
 * value doesn't match `best`. Used by the Score column to also flag
 * each "gun specialist" (top scorer per gun).
 *
 * Edge case: ties — multiple players could have the same best value.
 * Both rows get highlighted. Acceptable UX.
 *
 * Edge case: best is 0 (no one had any kills, etc.). We DON'T
 * highlight rows with 0 in that case (best > 0 guard); avoids visual
 * clutter when no one has a non-zero value.
 */
function BestTd({
  children,
  value,
  best,
  format,
  extraHighlight = false,
}: {
  children: React.ReactNode;
  value: number;
  best: number;
  format: "number" | "kd" | "percent";
  extraHighlight?: boolean;
}) {
  const isMatchBest = Math.abs(value - best) < 1e-9 && best > 0;
  const isBest = isMatchBest || extraHighlight;
  void format;
  return (
    <td
      className={cn(
        "px-3 py-3 text-right font-mono text-xs tabular-nums sm:text-sm",
        isBest ? "font-bold text-accent" : "text-text",
      )}
    >
      {children}
    </td>
  );
}

/* ---------- Cell-level link ---------- */

/**
 * RowLink: every cell in the row wraps its content in a Link to the
 * same href, so clicking anywhere in the row navigates. The Link
 * inherits the cell's display so layout is unaffected.
 *
 * Using replace={false} (default) preserves the back-button history
 * — if a user clicks several rows in succession, they can back-button
 * through them.
 */
function RowLink({
  children,
  href,
  ariaLabel,
}: {
  children: React.ReactNode;
  href: string;
  ariaLabel?: string;
}) {
  return (
    <Link
      href={href}
      // Scroll false because we manage scroll-into-view ourselves on
      // the player stats card mount — letting the browser scroll to top
      // would defeat that.
      scroll={false}
      aria-label={ariaLabel}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {children}
    </Link>
  );
}
