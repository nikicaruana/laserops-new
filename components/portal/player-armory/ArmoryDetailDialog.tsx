"use client";

import { useEffect, useRef } from "react";
import { formatFireRate } from "@/lib/cms/weapons";
import type { ArmoryEntry } from "@/lib/weapons/armory";

/**
 * ArmoryDetailDialog
 * --------------------------------------------------------------------
 * Full-detail modal for a single gun on the Armory page. Sibling to
 * components/weapons/WeaponDetailDialog.tsx — the player-portal variant
 * adds:
 *   - Locked-state rendering (blurred image, unlock criteria/progress
 *     instead of weapon body)
 *   - Per-player stats section ("Your stats with this gun") below the
 *     base spec stats, when the gun is unlocked AND the player has
 *     used it at least once
 *
 * Native <dialog> for top-layer + ESC + focus-trap for free; click-
 * outside-to-close wired explicitly. Parent owns the open/closed state
 * via the `entry` prop (null = unmounted).
 */

type Props = {
  entry: ArmoryEntry | null;
  onClose: () => void;
};

export function ArmoryDetailDialog({ entry, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Sync the native dialog open/closed state to the `entry` prop without
  // unmounting it. Native <dialog> + showModal() puts the element into
  // the browser's top-layer; if React unmounts the dialog while it's
  // still there, the underlying removeChild fails with a NotFoundError
  // because top-layer elements aren't children of their parent in the
  // way React expects. Keeping the dialog mounted and toggling via
  // showModal()/close() side-steps that entirely.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (entry !== null && !d.open && typeof d.showModal === "function") {
      d.showModal();
    } else if (entry === null && d.open) {
      d.close();
    }
  }, [entry]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;

    function handleBackdropClick(e: MouseEvent) {
      if (!d) return;
      if (e.target === d) onClose();
    }
    function handleNativeClose() {
      onClose();
    }

    d.addEventListener("click", handleBackdropClick);
    d.addEventListener("close", handleNativeClose);
    return () => {
      d.removeEventListener("click", handleBackdropClick);
      d.removeEventListener("close", handleNativeClose);
    };
  }, [onClose]);

  function handleClose() {
    const d = dialogRef.current;
    if (d?.open) d.close();
    else onClose();
  }

  // Render the dialog skeleton even when entry is null — the dialog
  // stays mounted, just closed. We early-return after the dialog wrapper
  // (see below) to skip rendering body content when there's nothing to
  // show, but keep the <dialog> element itself stable across opens.
  return (
    <dialog
      ref={dialogRef}
      className="m-auto w-[92vw] max-w-md rounded-sm border border-border-strong bg-bg-elevated p-0 text-text backdrop:bg-bg/80 backdrop:backdrop-blur-sm"
    >
      {entry !== null && (
        <ArmoryDialogBody
          entry={entry}
          isLocked={!entry.gunIsUnlocked}
          onClose={handleClose}
        />
      )}
    </dialog>
  );
}

function ArmoryDialogBody({
  entry,
  isLocked,
  onClose,
}: {
  entry: ArmoryEntry;
  isLocked: boolean;
  onClose: () => void;
}) {
  const title = isLocked
    ? entry.unlockDisplayText || "Locked"
    : entry.gunDisplayTitle || entry.gunName;

  const fireRateLabel = entry.spec
    ? formatFireRate(entry.spec.fireRate)
    : entry.gunFireRate || "—";

  const imageSrc =
    entry.gunPlayerImage ||
    (isLocked ? entry.gunLockedImg : "") ||
    entry.gunUsedImg ||
    entry.spec?.imageUrl ||
    "";

  return (
    <>
      <div className="max-h-[90vh] overflow-y-auto p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-accent">
              {isLocked ? "Locked" : "Weapon"}
              {entry.treeBranch !== "" && (
                <span className="ml-2 text-text-muted">{entry.treeBranch}</span>
              )}
            </p>
            <h3 className="text-xl font-extrabold leading-tight tracking-tight text-text sm:text-2xl">
              {title}
            </h3>
            {entry.gunClass !== "" && (
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-text-muted">
                {entry.gunClass}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 shrink-0 p-1 text-text-muted transition-colors hover:text-text"
          >
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="square"
            >
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        {/* Image — same yellow band treatment as the weapons gallery
            dialog. Locked guns get a heavy blur to mirror the card. */}
        {imageSrc !== "" && (
          <div
            className="mt-4 flex items-center justify-center px-3 py-4 sm:py-5"
            style={{ backgroundColor: "#ffde00" }}
          >
            <img
              src={imageSrc}
              alt={isLocked ? "" : entry.gunName}
              aria-hidden={isLocked || undefined}
              className={
                isLocked
                  ? "block h-24 w-auto select-none object-contain opacity-60 blur-md sm:h-32"
                  : "block h-24 w-auto select-none object-contain sm:h-32"
              }
              draggable={false}
            />
          </div>
        )}

        {/* Locked → unlock progress block. We replace the spec-stats and
            player-stats sections with a single "what to do to unlock"
            panel. Spec stats are still shown below for guns the player
            is working toward. */}
        {isLocked && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-text-muted">
              Unlock progress
            </p>
            <ProgressBar pct={entry.unlockProgressPct} />
            {entry.unlockProgressText !== "" && (
              <p className="mt-2 text-sm text-text-muted">
                {entry.unlockProgressText}
              </p>
            )}
            {(entry.unlockPrereqClass !== "" ||
              entry.unlockPrereqGun !== "") && (
              <p className="mt-2 text-xs text-text-muted">
                {entry.unlockPrereqClass !== "" && (
                  <>
                    Prerequisite class:{" "}
                    <span className="font-semibold text-text">
                      {entry.unlockPrereqClass}
                    </span>
                  </>
                )}
                {entry.unlockPrereqClass !== "" &&
                  entry.unlockPrereqGun !== "" &&
                  " · "}
                {entry.unlockPrereqGun !== "" && (
                  <>
                    Prerequisite gun:{" "}
                    <span className="font-semibold text-text">
                      {entry.unlockPrereqGun}
                    </span>
                  </>
                )}
              </p>
            )}
          </div>
        )}

        {/* Weapon stats — always shown so locked-gun viewers can see
            what they're working toward. Falls back to PlayerArmoryRow's
            own copies of the four primary stats when the Gun_Damage
            join missed. */}
        <div className="mt-4 grid grid-cols-4 gap-1.5 border-t border-border pt-4">
          <DialogStat
            label="Mag"
            value={fmtNum(entry.spec?.magSize ?? entry.gunMagSize)}
          />
          <DialogStat
            label="Dmg"
            value={fmtNum(entry.spec?.damage ?? entry.gunDamage)}
          />
          <DialogStat
            label="Reload"
            value={(() => {
              const reload = entry.spec?.reloadSeconds ?? entry.gunReload;
              return reload > 0 ? `${formatNumberShort(reload)}s` : "—";
            })()}
          />
          <DialogStat label="Rate" value={fireRateLabel} />
        </div>

        {/* Spec extras only available from Gun_Damage join. Skip the
            whole row if the spec didn't match. */}
        {entry.spec && (
          <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {entry.spec.range > 0 && (
              <DialogStat label="Range" value={fmtNum(entry.spec.range)} />
            )}
            {entry.spec.length > 0 && (
              <DialogStat label="Length" value={fmtNum(entry.spec.length)} />
            )}
            {entry.spec.weight > 0 && (
              <DialogStat label="Weight" value={fmtNum(entry.spec.weight)} />
            )}
            {entry.spec.difficulty !== "" && (
              <DialogStat label="Diff." value={entry.spec.difficulty} />
            )}
            {entry.spec.unlockTier !== "" && (
              <DialogStat label="Tier" value={entry.spec.unlockTier} />
            )}
          </div>
        )}

        {/* Player stats — only when unlocked AND the player has used the
            gun. Hidden for locked guns and for unlocked-but-unused
            guns (showing all zeros adds noise). */}
        {!isLocked && entry.hasUsedGun && (
          <div className="mt-5 border-t border-border pt-4">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-accent">
              Your stats with this gun
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              <DialogStat label="Matches" value={fmtNum(entry.matchesUsed)} />
              <DialogStat label="Kills" value={fmtNum(entry.killsTotal)} />
              <DialogStat label="Avg K" value={fmtFloat(entry.avgKills)} />
              <DialogStat label="Deaths" value={fmtNum(entry.deathsTotal)} />
              <DialogStat label="K/D" value={fmtFloat(entry.kdRatio)} />
              <DialogStat label="Acc." value={fmtPct(entry.avgAccuracy)} />
              <DialogStat label="Hits" value={fmtNum(entry.hitsTotal)} />
              <DialogStat label="Shots" value={fmtNum(entry.shotsTotal)} />
              <DialogStat label="Damage" value={fmtNum(entry.damageTotal)} />
              <DialogStat label="Avg Dmg" value={fmtFloat(entry.avgDamage)} />
              <DialogStat label="Score" value={fmtNum(entry.scoreTotal)} />
              <DialogStat label="Avg Score" value={fmtFloat(entry.avgScore)} />
              <DialogStat label="Wins" value={fmtNum(entry.winsUsingGun)} />
              <DialogStat
                label="Rds Won"
                value={fmtNum(entry.roundsWonUsingGun)}
              />
              <DialogStat
                label="Avg Rating"
                value={fmtFloat(entry.avgMatchRating)}
              />
              <DialogStat label="Level" value={fmtNum(entry.playerLevel)} />
            </div>
          </div>
        )}

        {/* Description — always at the bottom when present. Skipped
            silently when the Gun_Damage row has no description filled
            in (vs the public /weapons dialog which shows a placeholder
            — here the locked/progress block already gives the user
            something to read). */}
        {entry.spec?.description && entry.spec.description !== "" && (
          <p className="mt-4 border-t border-border pt-4 text-sm leading-relaxed text-text-muted sm:text-base">
            {entry.spec.description}
          </p>
        )}
      </div>
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
      className="mt-2 h-2 w-full overflow-hidden rounded-sm bg-bg"
    >
      <div
        className="h-full bg-accent"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function DialogStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-[0.55rem] font-bold uppercase tracking-[0.1em] text-text-muted">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-sm font-extrabold tabular-nums text-accent sm:text-base">
        {value}
      </p>
    </div>
  );
}

function fmtNum(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "—";
  return formatNumberShort(value);
}

function fmtFloat(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "—";
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function fmtPct(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "—";
  // Sheet stores accuracy as a 0-1 fraction OR 0-100 — accept both.
  // We normalise: anything ≤ 1.5 we treat as a fraction.
  const asPct = value <= 1.5 ? value * 100 : value;
  return `${asPct.toFixed(1).replace(/\.0$/, "")}%`;
}

function formatNumberShort(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(1).replace(/\.0$/, "");
}
