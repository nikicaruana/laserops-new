"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { ArmoryEntry } from "@/lib/weapons/armory";
import { AnimatedNumber } from "@/components/match-report/AnimatedNumber";
import { ArmoryDetailDialog } from "./ArmoryDetailDialog";
import { AnimatedProgressBar } from "./AnimatedProgressBar";

/**
 * ArmoryCard
 * --------------------------------------------------------------------
 * One gun card on the Armory page. Two visual modes:
 *
 *   - Unlocked: gun image (sharp), gun name, compact 4-stat strip
 *     (K/D, Avg Acc, Kills, Matches). Click → modal with full detail.
 *
 *   - Locked: gun image (blurred), unlock criteria text in place of the
 *     name, animated progress bar + count-up numerator. Click still
 *     opens the modal so the player can see the gun's base stats and
 *     what to do to unlock it.
 *
 * Animation:
 *   IntersectionObserver fires once when the card crosses 20% into the
 *   viewport. That sets `inView`, which kicks the progress bar transition
 *   and the count-up from 0 to the actual `pointsTowardUnlock`. Off-screen
 *   cards stay at 0 / 0 / static, so the page doesn't waste motion or
 *   batter the CPU on initial render of a long collapsed list.
 */

type Props = {
  entry: ArmoryEntry;
};

export function ArmoryCard({ entry }: Props) {
  const [open, setOpen] = useState(false);
  const [inView, setInView] = useState(false);
  const cardRef = useRef<HTMLButtonElement>(null);

  const isLocked = !entry.gunIsUnlocked;
  const imageSrc =
    entry.gunPlayerImage ||
    (isLocked ? entry.gunLockedImg : "") ||
    entry.gunUsedImg ||
    entry.spec?.imageUrl ||
    "";

  // Animate-once-when-visible. Disconnects on first intersection so the
  // animation doesn't re-fire each time the user scrolls past the card.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      // SSR / older browsers — just play immediately.
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            obs.disconnect();
            break;
          }
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Whether to render the count-up numerator using AnimatedNumber. We
  // need a positive `unlockReqPoints` for it to be a meaningful "X / Y"
  // style label; for level-only unlocks (no point requirement) the sheet
  // gives us a string like "Reach Level 13" — fall back to that.
  const showCountUp = isLocked && entry.unlockReqPoints > 0;

  return (
    <>
      <button
        ref={cardRef}
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group flex w-full flex-col rounded-sm border border-border bg-bg-overlay text-left transition-colors",
          "hover:border-border-strong focus:border-border-strong focus:outline-none",
          /* Desktop: horizontal layout — image left, stats right */
          "lg:flex-row",
        )}
        aria-label={
          isLocked
            ? `${entry.gunName} (locked): ${entry.unlockDisplayText || "unlock progress"}`
            : `${entry.gunDisplayTitle || entry.gunName}: view details`
        }
      >
        {/* Image area — yellow band. On desktop: fixed width, full card height. */}
        <div
          className="flex h-28 shrink-0 items-center justify-center px-3 sm:h-32 lg:h-auto lg:w-72 lg:self-stretch"
          style={{ backgroundColor: "#ffde00" }}
        >
          {imageSrc !== "" && (
            <img
              src={imageSrc}
              alt={isLocked ? "" : entry.gunName}
              aria-hidden={isLocked || undefined}
              className={cn(
                "block h-20 w-auto select-none object-contain sm:h-24 lg:h-40",
                isLocked && "opacity-60 blur-[6px]",
              )}
              draggable={false}
            />
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-1.5 p-4 sm:p-5 lg:justify-center">
          {/* Top row: tree branch label (left) + status pill (right) */}
          <div className="flex items-center justify-between gap-2">
            {entry.treeBranch !== "" && (
              <span className="text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-accent">
                {entry.treeBranch}
              </span>
            )}
            {isLocked ? (
              <span className="rounded-sm border border-border-strong px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.14em] text-text-muted">
                Locked
              </span>
            ) : !entry.hasUsedGun ? (
              <span className="rounded-sm border border-border px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.14em] text-text-muted">
                Unused
              </span>
            ) : null}
          </div>

          {/* Title — gun name when unlocked, unlock criteria when not. */}
          <h3 className="text-center text-xl font-extrabold leading-tight tracking-tight text-text sm:text-3xl lg:text-left lg:text-2xl">
            {isLocked
              ? entry.unlockDisplayText || "Locked"
              : entry.gunDisplayTitle || entry.gunName}
          </h3>

          {/* Body content varies by state. */}
          {isLocked ? (
            <div className="mt-1">
              <AnimatedProgressBar
                pct={entry.unlockProgressPct}
                play={inView}
              />
              <p className="mt-2 text-center text-sm text-text-muted lg:text-left">
                {showCountUp ? (
                  <>
                    <AnimatedNumber
                      key={`${entry.gunName}-${inView ? "play" : "idle"}`}
                      value={inView ? entry.pointsTowardUnlock : 0}
                      format="comma"
                      duration={2000}
                    />
                    {" / "}
                    {entry.unlockReqPoints.toLocaleString("en-US")}
                  </>
                ) : (
                  entry.unlockProgressText
                )}
              </p>
            </div>
          ) : entry.hasUsedGun ? (
            <div className="mt-1 grid grid-cols-4 gap-2">
              <MiniStat label="K/D" value={fmtFloat(entry.kdRatio)} />
              <MiniStat label="Acc." value={fmtPct(entry.avgAccuracy)} />
              <MiniStat label="Kills" value={fmtNum(entry.killsTotal)} />
              <MiniStat
                label="Matches"
                value={fmtNum(entry.matchesUsed)}
              />
            </div>
          ) : (
            <p className="mt-1 text-center text-sm italic text-text-muted lg:text-left">
              Unlocked but never used. Tap for stats and details.
            </p>
          )}
        </div>
      </button>

      <ArmoryDetailDialog
        entry={open ? entry : null}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">
        {label}
      </p>
      <p className="mt-1 font-mono text-base font-extrabold tabular-nums text-accent sm:text-2xl">
        {value}
      </p>
    </div>
  );
}

function fmtNum(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "—";
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  return value.toFixed(1).replace(/\.0$/, "");
}

function fmtFloat(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "—";
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function fmtPct(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "—";
  const asPct = value <= 1.5 ? value * 100 : value;
  return `${asPct.toFixed(1).replace(/\.0$/, "")}%`;
}
