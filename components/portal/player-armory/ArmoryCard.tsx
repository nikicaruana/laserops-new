"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { ArmoryEntry } from "@/lib/weapons/armory";
import { ArmoryDetailDialog } from "./ArmoryDetailDialog";

/**
 * ArmoryCard
 * --------------------------------------------------------------------
 * One gun card on the Armory page. Two visual modes:
 *
 *   - Unlocked: gun image (sharp), gun name, compact 4-stat strip
 *     (K/D, Avg Acc, Kills, Matches). Click → modal with full detail.
 *
 *   - Locked: gun image (blurred), unlock criteria text in place of the
 *     name, progress bar driven by Unlock_Progress_Pct, optional caption
 *     (Unlock_Progress_Text). Click still opens the modal so the player
 *     can see the gun's base stats and what to do to unlock it.
 *
 * The Player_Armory_Public sheet already resolves Gun_Player_Image to
 * the right variant (used vs locked) per row, so we just consume that
 * single field rather than picking between Gun_Used_Img / Gun_Locked_Img
 * here.
 */

type Props = {
  entry: ArmoryEntry;
};

export function ArmoryCard({ entry }: Props) {
  const [open, setOpen] = useState(false);
  const isLocked = !entry.gunIsUnlocked;
  // Resolve the image. The sheet's Gun_Player_Image column is supposed
  // to pre-pick the right variant per row, but locked rows often leave
  // it empty — fall back to the explicit locked/used columns so locked
  // cards still render a (blurred) silhouette instead of an empty box.
  const imageSrc =
    entry.gunPlayerImage ||
    (isLocked ? entry.gunLockedImg : "") ||
    entry.gunUsedImg ||
    entry.spec?.imageUrl ||
    "";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group flex w-full flex-col rounded-sm border border-border bg-bg-overlay text-left transition-colors",
          "hover:border-border-strong focus:border-border-strong focus:outline-none",
        )}
        aria-label={
          isLocked
            ? `${entry.gunName} (locked): ${entry.unlockDisplayText || "unlock progress"}`
            : `${entry.gunDisplayTitle || entry.gunName}: view details`
        }
      >
        {/* Image area — yellow band that matches the /weapons gallery
            visual language. Locked guns get a heavy CSS blur. */}
        <div
          className="flex h-28 items-center justify-center px-3 sm:h-32"
          style={{ backgroundColor: "#ffde00" }}
        >
          {imageSrc !== "" && (
            <img
              src={imageSrc}
              alt={isLocked ? "" : entry.gunName}
              aria-hidden={isLocked || undefined}
              className={cn(
                "block h-20 w-auto select-none object-contain sm:h-24",
                isLocked && "opacity-60 blur-md",
              )}
              draggable={false}
            />
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
          {/* Tree branch + class eyebrow */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.55rem] font-bold uppercase tracking-[0.16em] text-text-muted">
              {entry.gunClass || entry.treeBranch}
            </p>
            {isLocked ? (
              <span className="rounded-sm border border-border-strong px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.14em] text-text-muted">
                Locked
              </span>
            ) : entry.hasUsedGun ? null : (
              <span className="rounded-sm border border-border px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.14em] text-text-muted">
                Unused
              </span>
            )}
          </div>

          {/* Title — gun name when unlocked, unlock criteria when not. */}
          <h3 className="text-base font-extrabold leading-tight tracking-tight text-text sm:text-lg">
            {isLocked
              ? entry.unlockDisplayText || "Locked"
              : entry.gunDisplayTitle || entry.gunName}
          </h3>

          {/* Body content varies by state. */}
          {isLocked ? (
            <div className="mt-1">
              <ProgressBar pct={entry.unlockProgressPct} />
              {entry.unlockProgressText !== "" && (
                <p className="mt-1.5 text-xs text-text-muted">
                  {entry.unlockProgressText}
                </p>
              )}
            </div>
          ) : entry.hasUsedGun ? (
            <div className="mt-1 grid grid-cols-4 gap-1.5">
              <MiniStat label="K/D" value={fmtFloat(entry.kdRatio)} />
              <MiniStat label="Acc." value={fmtPct(entry.avgAccuracy)} />
              <MiniStat label="Kills" value={fmtNum(entry.killsTotal)} />
              <MiniStat
                label="Matches"
                value={fmtNum(entry.matchesUsed)}
              />
            </div>
          ) : (
            <p className="mt-1 text-xs italic text-text-muted">
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

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1.5 w-full overflow-hidden rounded-sm bg-bg"
    >
      <div
        className="h-full bg-accent"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-[0.5rem] font-bold uppercase tracking-[0.1em] text-text-muted">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-xs font-extrabold tabular-nums text-accent sm:text-sm">
        {value}
      </p>
    </div>
  );
}

function fmtNum(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "—";
  if (Number.isInteger(value)) return value.toString();
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
