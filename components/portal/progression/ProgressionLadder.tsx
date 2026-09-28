"use client";

/**
 * components/portal/progression/ProgressionLadder.tsx
 * --------------------------------------------------------------------
 * A player's own progression, grouped into tiers of 5 levels. Each tier is a
 * collapsible card: a representative badge, the level range + rank (shown once at
 * the tier level - not repeated per level, and hidden entirely while the tier is
 * locked), a 5-pip progress strip, and a count of levels/rewards. Expanding a
 * tier reveals its levels - each with a fixed-size badge, an equal-length
 * progress bar, and (when there's a reward) the reward's art on the right, highly
 * blurred until that level is reached. Clicking an unlocked reward opens a popup
 * explaining what it is and how to use it. The current tier is open by default.
 */
import { useState } from "react";
import { XpProgressBar } from "@/components/portal/player-summary/XpProgressBar";
import { Modal } from "@/components/ui/Modal";
import { cldImage } from "@/lib/cld";
import { cn } from "@/lib/cn";

export type LevelRow = {
  level: number;
  rankName: string;
  badgeUrl: string;
  reached: boolean;
  pct: number;
  prizeTitle: string;
  prizeDescription: string;
  prizeIconUrl: string;
  rewardImageUrl: string;
  rewardTokens: number;
  rewardDoubleXp: number;
  rewardXp15: number;
};

const TIER_SIZE = 5;

function fmtTokens(n: number): string {
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(2)));
}

function hasReward(r: LevelRow): boolean {
  return r.prizeTitle !== "" || r.rewardTokens > 0 || r.rewardDoubleXp > 0 || r.rewardXp15 > 0;
}

/** What the reward is + how to use it, for the popup. */
function rewardInfo(r: LevelRow): { title: string; body: string } | null {
  if (r.rewardXp15 > 0)
    return {
      title: "1.5x XP boost",
      body: "Earns you 1.5 times the XP from a single game. Apply it when you sign in at the game - you'll be offered your boosts. It's used up for that one game.",
    };
  if (r.rewardDoubleXp > 0)
    return {
      title: "Double XP boost",
      body: "Earns you double the XP from a single game. Apply it when you sign in at the game - you'll be offered your boosts. It's used up for that one game.",
    };
  if (r.rewardTokens > 0) {
    const half = r.rewardTokens < 1;
    return {
      title: half ? "Half game token" : "Game token",
      body: half
        ? "Worth half a game. Apply it when you pay for a game to cover half the cost, then pay the rest."
        : "1 token = 1 free game. Use it to pay for a game instead of cash. Tokens stay in your wallet until you use them.",
    };
  }
  return null;
}

/** One level inside an expanded tier. */
function LevelItem({ r, currentLevel }: { r: LevelRow; currentLevel: number }) {
  const [open, setOpen] = useState(false);
  const isCurrent = r.level === currentLevel;
  const locked = !r.reached;
  const rewardChips: string[] = [];
  if (r.rewardTokens > 0) rewardChips.push(`${fmtTokens(r.rewardTokens)} game token${r.rewardTokens === 1 ? "" : "s"}`);
  if (r.rewardDoubleXp > 0) rewardChips.push(`${r.rewardDoubleXp} × Double XP`);
  if (r.rewardXp15 > 0) rewardChips.push(`${r.rewardXp15} × 1.5x XP`);
  const prize = hasReward(r);
  const info = rewardInfo(r);
  const rewardArt = r.rewardImageUrl ? cldImage(r.rewardImageUrl, { w: 200, trim: true }) : "";

  return (
    <li
      className={cn(
        "relative border p-4 transition-colors",
        isCurrent ? "border-accent bg-accent/[0.04]" : r.reached ? "border-border" : "border-border/60",
      )}
    >
      <div className="flex items-center gap-4">
        {/* Badge - fixed box so every row's progress bar starts at the same x. */}
        <div className="shrink-0">
          {r.badgeUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cldImage(r.badgeUrl, { w: 384 })}
              alt=""
              aria-hidden
              className={cn("h-14 w-14 object-contain", locked && "blur-[3px] opacity-60")}
            />
          ) : (
            <span className={cn("flex h-14 w-14 items-center justify-center border border-border text-sm font-bold text-text-subtle", locked && "blur-[2px]")}>
              {r.level}
            </span>
          )}
        </div>

        {/* Level + progress + reward label (rank name is only shown at tier level). */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className={cn("text-sm font-extrabold uppercase tracking-[0.08em]", isCurrent ? "text-accent" : "text-text")}>
              Level {r.level}
            </span>
            {r.level < currentLevel ? (
              <span className="shrink-0 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-emerald-400">Completed</span>
            ) : r.reached ? (
              <span className="shrink-0 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-accent">Reached</span>
            ) : (
              <span className="shrink-0 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-text-subtle">Locked</span>
            )}
          </div>

          <div className="mt-2">
            <XpProgressBar pct={r.pct} ariaLabel={`Level ${r.level} progress: ${Math.round(r.pct)}%`} />
          </div>

          {prize && (
            <div className={cn("mt-3 min-w-0", locked && "select-none blur-[4px]")}>
              {r.prizeTitle ? (
                <p className="truncate text-xs font-bold uppercase tracking-[0.08em] text-accent">{r.prizeTitle}</p>
              ) : rewardChips.length > 0 ? (
                <p className="truncate text-[0.7rem] font-semibold text-accent">{rewardChips.join(" · ")}</p>
              ) : null}
              {r.prizeDescription && <p className="truncate text-[0.7rem] text-text-muted">{r.prizeDescription}</p>}
            </div>
          )}
        </div>

        {/* Reward art column - always reserved (so bars line up); blurred until
            reached; clickable once unlocked to explain the reward. */}
        <div className="flex w-14 shrink-0 items-center justify-center">
          {rewardArt &&
            (locked ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={rewardArt} alt="" aria-hidden className="h-12 w-12 object-contain blur-md opacity-70 sm:h-14 sm:w-14" />
            ) : (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded-full transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label={`What is the ${info?.title ?? "reward"}?`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={rewardArt} alt={info?.title ?? "Reward"} className="h-12 w-12 object-contain sm:h-14 sm:w-14" />
              </button>
            ))}
        </div>
      </div>

      {open && info && (
        <Modal title={info.title} onClose={() => setOpen(false)}>
          <div className="flex flex-col items-center gap-4 text-center">
            {rewardArt && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={rewardArt} alt="" aria-hidden className="h-20 w-20 object-contain" />
            )}
            <p className="text-sm leading-relaxed text-text-muted">{info.body}</p>
            <p className="text-[0.7rem] uppercase tracking-[0.12em] text-text-subtle">Unlocked at Level {r.level}</p>
          </div>
        </Modal>
      )}
    </li>
  );
}

export function ProgressionLadder({ rows, currentLevel }: { rows: LevelRow[]; currentLevel: number }) {
  // Group into tiers of 5.
  const tiers: { min: number; max: number; rows: LevelRow[] }[] = [];
  for (let i = 0; i < rows.length; i += TIER_SIZE) {
    const group = rows.slice(i, i + TIER_SIZE);
    tiers.push({ min: group[0].level, max: group[group.length - 1].level, rows: group });
  }
  const currentTier = tiers.findIndex((t) => currentLevel >= t.min && currentLevel <= t.max);
  const [open, setOpen] = useState<Set<number>>(() => new Set([currentTier >= 0 ? currentTier : 0]));
  const toggle = (idx: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      {tiers.map((t, idx) => {
        const reachedCount = t.rows.filter((r) => r.reached).length;
        const rewardCount = t.rows.filter(hasReward).length;
        const complete = currentLevel >= t.max;
        const locked = currentLevel < t.min;
        const isCurrentTier = idx === currentTier;
        const isOpen = open.has(idx);
        // Representative badge: the highest reached in the tier, else the first.
        const rep = [...t.rows].reverse().find((r) => r.reached) ?? t.rows[0];
        const names = [...new Set(t.rows.map((r) => r.rankName).filter(Boolean))];
        const rankLabel = names.length === 1 ? names[0] : names.length > 1 ? `${names[0]} – ${names[names.length - 1]}` : "";

        return (
          <div
            key={idx}
            className={cn(
              "border portal-surface transition-colors",
              isCurrentTier ? "border-accent" : complete ? "border-border" : "border-border/60",
            )}
          >
            <button
              type="button"
              onClick={() => toggle(idx)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-4 p-4 text-left"
            >
              <div className="shrink-0">
                {rep.badgeUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cldImage(rep.badgeUrl, { w: 384 })}
                    alt=""
                    aria-hidden
                    className={cn("h-14 w-14 object-contain sm:h-16 sm:w-16", locked && "blur-[3px] opacity-60")}
                  />
                ) : (
                  <span className={cn("flex h-14 w-14 items-center justify-center border border-border text-sm font-bold text-text-subtle", locked && "blur-[2px]")}>
                    {t.min}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-baseline gap-2">
                    <span className={cn("text-sm font-extrabold uppercase tracking-[0.08em]", isCurrentTier ? "text-accent" : "text-text")}>
                      Levels {t.min}–{t.max}
                    </span>
                    {/* Rank name shown once here, and hidden until the tier is reached. */}
                    {!locked && rankLabel && <span className="truncate text-xs text-text-muted">{rankLabel}</span>}
                  </span>
                  <span className="shrink-0 text-[0.6rem] font-bold uppercase tracking-[0.12em]">
                    {complete ? (
                      <span className="text-emerald-400">Complete</span>
                    ) : locked ? (
                      <span className="text-text-subtle">Locked</span>
                    ) : (
                      <span className="text-accent">In progress</span>
                    )}
                  </span>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="flex gap-1" aria-hidden>
                    {t.rows.map((r) => (
                      <span key={r.level} className={cn("h-1.5 w-6 rounded-sm", r.reached ? "bg-accent" : "bg-border")} />
                    ))}
                  </span>
                  <span className="text-[0.65rem] text-text-subtle">
                    {reachedCount}/{t.rows.length} reached
                    {rewardCount > 0 && ` · ${rewardCount} reward${rewardCount === 1 ? "" : "s"}`}
                  </span>
                </div>
              </div>

              <svg
                aria-hidden
                viewBox="0 0 10 6"
                className={cn("h-2.5 w-2.5 shrink-0 text-text-muted transition-transform", isOpen && "rotate-180")}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="square"
              >
                <path d="M1 1l4 4 4-4" />
              </svg>
            </button>

            {isOpen && (
              <ol className="flex flex-col gap-3 border-t border-border/60 p-4">
                {t.rows.map((r) => (
                  <LevelItem key={r.level} r={r} currentLevel={currentLevel} />
                ))}
              </ol>
            )}
          </div>
        );
      })}
    </div>
  );
}
