"use client";

import { useEffect, useRef, useState } from "react";
import type { MatchPlayer } from "@/lib/match-report/engine";
import type { RankLevel } from "@/lib/cms/ranking-system";
import { getRankByLevel } from "@/lib/cms/ranking-system";
import { AnimatedNumber } from "./AnimatedNumber";

/**
 * XpCard
 * --------------------------------------------------------------------
 * Visualises the player's XP progression for a single match.
 *
 * Animation design (per Niki's spec):
 *
 *   - Progress bar resets to 0 when a player is selected (not from
 *     previous player's progress)
 *   - The bar shows TWO colours:
 *       Color A: the player's "before-match baseline" within the
 *                current level (i.e. what they had at level start)
 *       Color B: the XP earned IN this match, animated on top of the
 *                baseline
 *   - If they leveled up: bar fills to 100% (Color B reaches end),
 *     then resets to 0 in the next level's frame, with Color A also
 *     resetting (no baseline at the new level — they entered at 0).
 *   - Multi-level jumps are handled — each level boundary is a slice.
 *
 *   - Total animation duration is ~3 seconds, distributed proportionally
 *     across slices by their XP delta.
 *
 *   - Level-up display: side-by-side badges with an arrow between them,
 *     plus "Level X → Level Y" text. If no level-up: single badge.
 *
 *   - Both badges sit inside dark inset boxes so they're not lost on
 *     the yellow card background (badges are themselves yellow-themed).
 */

type Props = {
  player: MatchPlayer;
  ranks: RankLevel[];
};

const TOTAL_ANIMATION_DURATION_MS = 3000;

/**
 * One slice of the animation = the progression within a single level.
 * For a no-level-up match, there's exactly one slice. For a level-up,
 * there are 2+ slices (one per level traversed).
 */
type Slice = {
  level: number;
  /** XP threshold for this level (start of bar). */
  levelMin: number;
  /** XP threshold for the next level (end of bar = 100%). */
  nextLevelMin: number;
  /** XP the player started this slice with (within the level). */
  baselineXp: number;
  /** XP earned during this slice (within the level). */
  earnedXp: number;
  /** Computed: 0..1 fill % for the baseline (Color A). */
  baselineFill: number;
  /** Computed: 0..1 fill % for the end of this slice (Color B target). */
  endFill: number;
  /** Computed: animation duration for this slice in ms, proportional
   *  to earnedXp relative to the total earned across all slices. */
  durationMs: number;
};

function computeSlices(
  player: MatchPlayer,
  ranks: RankLevel[],
): Slice[] {
  const startLevel = player.xpCurrentLevelBeforeMatch;
  const endLevel = player.xpCurrentLevelAfterMatch;
  const totalEarned = player.xpTotalAfterMatch - player.xpTotalBeforeMatch;

  // Defensive: if no levels are available, return a single best-effort
  // slice using whatever the data sheet has directly.
  if (ranks.length === 0) {
    return [
      {
        level: startLevel,
        levelMin: 0,
        nextLevelMin: 1,
        baselineXp: clampProgress(player.xpLevelProgressStart),
        earnedXp:
          clampProgress(player.xpLevelProgressEnd) -
          clampProgress(player.xpLevelProgressStart),
        baselineFill: clampProgress(player.xpLevelProgressStart),
        endFill: clampProgress(player.xpLevelProgressEnd),
        durationMs: TOTAL_ANIMATION_DURATION_MS,
      },
    ];
  }

  const slices: Slice[] = [];
  // Iterate from start level up to (and including) end level, building
  // one slice per level.
  for (let lvl = startLevel; lvl <= endLevel; lvl++) {
    const thisLevel = getRankByLevel(ranks, lvl);
    const nextLevel = getRankByLevel(ranks, lvl + 1);
    if (!thisLevel) continue;

    const levelMin = thisLevel.scoreThreshold;
    // If there's no defined next level (the player is at max level),
    // fall back to thisLevel + 1 unit so the bar isn't a divide-by-zero.
    const nextLevelMin = nextLevel
      ? nextLevel.scoreThreshold
      : levelMin + Math.max(1, totalEarned);
    const levelRange = nextLevelMin - levelMin;
    if (levelRange <= 0) continue;

    let baselineXp: number;
    let earnedXp: number;

    if (lvl === startLevel && lvl === endLevel) {
      // Single-slice case: no level-up
      baselineXp = player.xpTotalBeforeMatch - levelMin;
      earnedXp = player.xpTotalAfterMatch - player.xpTotalBeforeMatch;
    } else if (lvl === startLevel) {
      // First slice of a multi-slice case: started here, leveled up
      // out of it. Baseline = where they began, earned = up to 100%
      // (i.e. nextLevelMin).
      baselineXp = player.xpTotalBeforeMatch - levelMin;
      earnedXp = nextLevelMin - player.xpTotalBeforeMatch;
    } else if (lvl === endLevel) {
      // Final slice: entered this level at 0, ended at xpTotalAfter
      baselineXp = 0;
      earnedXp = player.xpTotalAfterMatch - levelMin;
    } else {
      // Middle slice (passed all the way through): 0 to 100%
      baselineXp = 0;
      earnedXp = levelRange;
    }

    // Clamp to non-negative for safety.
    baselineXp = Math.max(0, baselineXp);
    earnedXp = Math.max(0, earnedXp);

    const baselineFill = Math.min(1, baselineXp / levelRange);
    const endFill = Math.min(1, (baselineXp + earnedXp) / levelRange);

    slices.push({
      level: lvl,
      levelMin,
      nextLevelMin,
      baselineXp,
      earnedXp,
      baselineFill,
      endFill,
      // Duration set in a second pass (need totalEarned to compute proportions)
      durationMs: 0,
    });
  }

  // Distribute the total animation duration across slices proportionally
  // to their earnedXp. If all slices have 0 earned (degenerate case),
  // distribute equally.
  const totalSliceEarned = slices.reduce((acc, s) => acc + s.earnedXp, 0);
  if (totalSliceEarned > 0) {
    for (const s of slices) {
      s.durationMs = Math.max(
        300, // floor — every slice gets at least 0.3s so the user can see it
        (s.earnedXp / totalSliceEarned) * TOTAL_ANIMATION_DURATION_MS,
      );
    }
  } else {
    const each = TOTAL_ANIMATION_DURATION_MS / Math.max(1, slices.length);
    for (const s of slices) s.durationMs = each;
  }

  return slices;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function clampProgress(value: number): number {
  let v = value;
  if (v > 1.5) v = v / 100;
  if (v < 0) v = 0;
  if (v > 1) v = 1;
  return v;
}

export function XpCard({ player, ranks }: Props) {
  const beforeRank = getRankByLevel(ranks, player.xpCurrentLevelBeforeMatch);
  const afterRank = getRankByLevel(ranks, player.xpCurrentLevelAfterMatch);

  // Badge URLs: prefer the ranking system's badge for each level,
  // fall back to the row's stored badge URL.
  const beforeBadgeUrl = beforeRank?.badgeUrl || player.rankBadgeUrl;
  const afterBadgeUrl = afterRank?.badgeUrl || player.xpLevelBadgeImage || beforeBadgeUrl;

  // Derive level-up directly from the level numbers rather than relying
  // on the XP_Level_Up_In_Match boolean column. This is more reliable —
  // the column might be inconsistently populated, but if the after-level
  // is genuinely greater than the before-level, the player leveled up.
  const leveledUp =
    player.xpCurrentLevelAfterMatch > player.xpCurrentLevelBeforeMatch;

  // ---- Animation state ----
  // We track which slice is currently animating (-1 = not started yet),
  // the current slice's progress (0..1), and the displayed level.
  const [currentSliceIdx, setCurrentSliceIdx] = useState(0);
  const [sliceProgress, setSliceProgress] = useState(0);
  const slicesRef = useRef<Slice[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const slices = computeSlices(player, ranks);
    slicesRef.current = slices;

    if (slices.length === 0) {
      return;
    }

    if (prefersReducedMotion) {
      // Skip directly to final state — last slice fully animated.
      setCurrentSliceIdx(slices.length - 1);
      setSliceProgress(1);
      return;
    }

    // Reset for fresh animation
    setCurrentSliceIdx(0);
    setSliceProgress(0);

    let sliceStartTime = performance.now();
    let sliceIdx = 0;

    function tick(now: number) {
      const slice = slices[sliceIdx];
      if (!slice) return;
      const elapsed = now - sliceStartTime;
      const t = Math.min(elapsed / slice.durationMs, 1);
      const eased = easeOutCubic(t);
      setSliceProgress(eased);

      if (t < 1) {
        rafRef.current = window.requestAnimationFrame(tick);
      } else {
        // Move to next slice if there is one
        if (sliceIdx < slices.length - 1) {
          sliceIdx += 1;
          sliceStartTime = performance.now();
          setCurrentSliceIdx(sliceIdx);
          setSliceProgress(0);
          rafRef.current = window.requestAnimationFrame(tick);
        }
      }
    }

    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.nickname]);

  const currentSlice = slicesRef.current[currentSliceIdx];
  // Compute current "earned fill" — from baselineFill animating toward endFill
  const earnedFillCurrent = currentSlice
    ? currentSlice.baselineFill +
      (currentSlice.endFill - currentSlice.baselineFill) * sliceProgress
    : 0;
  const baselineFillCurrent = currentSlice?.baselineFill ?? 0;
  const displayedLevel = currentSlice?.level ?? player.xpCurrentLevelBeforeMatch;

  return (
    <div className="rounded-sm bg-accent px-5 py-5 text-bg sm:px-6 sm:py-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        {/* Badge area:
            - No level-up: single dark inset box with the player's
              current badge.
            - Level-up: ONE bigger dark inset box containing BOTH the
              before and after badges with a red ▶ between them.
            Same dark inset treatment as everywhere else (yellow-themed
            badge images need a dark backdrop to read on the yellow card).
            The combined box reads as a single "level transition unit"
            rather than two separate badges. */}
        <div className="self-center sm:self-auto">
          {leveledUp ? (
            <div className="flex items-center gap-3 rounded-sm bg-bg p-3 sm:gap-4 sm:p-4">
              <BadgeImage imageUrl={beforeBadgeUrl} altLevel={player.xpCurrentLevelBeforeMatch} />
              <span
                aria-hidden
                className="select-none text-lg leading-none text-red-800 sm:text-xl"
              >
                ▶
              </span>
              <BadgeImage imageUrl={afterBadgeUrl} altLevel={player.xpCurrentLevelAfterMatch} />
            </div>
          ) : (
            <BadgeBox imageUrl={beforeBadgeUrl} altLevel={player.xpCurrentLevelBeforeMatch} />
          )}
        </div>

        {/* Level + total + progress bar */}
        <div className="flex flex-1 flex-col gap-2 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3">
            {leveledUp ? (
              // "Level 1 ▶ 2" — only the "▶ 2" portion in the muted red,
              // leading "Level 1" stays dark (matches the rest of the
              // card text). The 2nd "Level" word is dropped per spec —
              // the arrow + new number alone reads cleanly. The ▶ glyph
              // itself is rendered at half the surrounding font size so
              // it's a subtle visual cue rather than a dominant element;
              // align-middle keeps it baseline-aligned with the numbers.
              <span className="text-2xl font-extrabold sm:text-3xl">
                Level {player.xpCurrentLevelBeforeMatch}{" "}
                <span className="text-red-800">
                  <span className="align-middle text-base sm:text-lg">▶</span>{" "}
                  {player.xpCurrentLevelAfterMatch}
                </span>
              </span>
            ) : (
              <span className="text-2xl font-extrabold sm:text-3xl">
                Level {displayedLevel}
              </span>
            )}
            <span className="text-sm font-bold sm:text-base">
              +{" "}
              <AnimatedNumber
                key={`${player.nickname}-earned-xp`}
                value={player.xpEarnedThisMatch}
                format="comma"
                duration={TOTAL_ANIMATION_DURATION_MS}
              />{" "}
              Total XP
            </span>
          </div>

          {/* Progress bar — two stacked colour layers, side by side:
              1. Track (very subtle dark) — the empty portion
              2. Baseline (BLACK) — the XP the player entered the match
                 with, within this level. Sits at the left, fixed width.
              3. Earned (muted RED) — the XP gained IN this match. Sits
                 IMMEDIATELY to the right of the baseline. Both colours
                 are visible: black shows what they had, red shows what
                 they gained.
              The red is `red-800` (deep / muted red, oklch(0.444 0.177)) —
              chosen over the more saturated red-600 to reduce eye strain
              on the bright yellow card background. Same red used for the
              ▶ marker in the badges row and the Level X ▶ Y text. */}
          <div
            className="relative h-3 w-full overflow-hidden rounded-full bg-bg/15"
            role="progressbar"
            aria-valuenow={Math.round(earnedFillCurrent * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Level progress"
          >
            <div
              className="absolute inset-y-0 left-0 bg-bg"
              style={{ width: `${baselineFillCurrent * 100}%` }}
            />
            <div
              className="absolute inset-y-0 bg-red-800"
              style={{
                left: `${baselineFillCurrent * 100}%`,
                width: `${Math.max(0, earnedFillCurrent - baselineFillCurrent) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Desktop breakdown */}
        <div className="hidden flex-col items-end gap-0.5 sm:flex">
          <BreakdownLine
            key={`${player.nickname}-points`}
            label="from points"
            value={player.xpFromPoints}
          />
          <BreakdownLine
            key={`${player.nickname}-rounds`}
            label="from rounds"
            value={player.xpFromWins}
          />
          <BreakdownLine
            key={`${player.nickname}-acco`}
            label="from accolades"
            value={player.xpFromAccolades}
          />
        </div>
      </div>

      {/* Mobile breakdown */}
      <div className="mt-3 flex flex-col gap-0.5 sm:hidden">
        <BreakdownLine
          key={`${player.nickname}-points-m`}
          label="from points"
          value={player.xpFromPoints}
        />
        <BreakdownLine
          key={`${player.nickname}-rounds-m`}
          label="from rounds"
          value={player.xpFromWins}
        />
        <BreakdownLine
          key={`${player.nickname}-acco-m`}
          label="from accolades"
          value={player.xpFromAccolades}
        />
      </div>
    </div>
  );
}

/* ---------- Subcomponents ---------- */

/**
 * BadgeBox
 * Single badge wrapped in a dark inset box. Used for the no-level-up
 * case where there's just one badge.
 */
function BadgeBox({
  imageUrl,
  altLevel,
}: {
  imageUrl: string;
  altLevel: number;
}) {
  if (imageUrl === "") {
    return (
      <div
        className="h-20 w-20 rounded-sm bg-bg sm:h-24 sm:w-24"
        aria-hidden
      />
    );
  }
  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-sm bg-bg p-2 sm:h-24 sm:w-24">
      <img
        src={imageUrl}
        alt={`Level ${altLevel} badge`}
        loading="lazy"
        className="block h-full w-full object-contain"
      />
    </div>
  );
}

/**
 * BadgeImage
 * Raw badge image WITHOUT its own box. Used inside the combined
 * level-up box so the two badges sit in a single dark container with
 * the ▶ marker between them.
 */
function BadgeImage({
  imageUrl,
  altLevel,
}: {
  imageUrl: string;
  altLevel: number;
}) {
  if (imageUrl === "") {
    return (
      <span
        className="block h-16 w-16 sm:h-20 sm:w-20"
        aria-hidden
      />
    );
  }
  return (
    <img
      src={imageUrl}
      alt={`Level ${altLevel} badge`}
      loading="lazy"
      className="block h-16 w-16 object-contain sm:h-20 sm:w-20"
    />
  );
}

function BreakdownLine({ label, value }: { label: string; value: number }) {
  return (
    <p className="text-[0.7rem] font-semibold sm:text-xs">
      <span className="font-mono font-bold tabular-nums">
        +<AnimatedNumber value={value} format="comma" duration={TOTAL_ANIMATION_DURATION_MS} /> XP
      </span>{" "}
      <span className="font-normal">{label}</span>
    </p>
  );
}
