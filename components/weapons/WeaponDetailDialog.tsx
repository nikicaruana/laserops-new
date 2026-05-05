"use client";

import { useEffect, useRef } from "react";
import type { Weapon } from "@/lib/cms/weapons";
import { formatFireRate } from "@/lib/cms/weapons";

/**
 * WeaponDetailDialog
 * --------------------------------------------------------------------
 * Native <dialog> popup that shows the full description for a weapon
 * along with its image and key stats. Opens when the user taps an
 * already-centred gun in the gallery (second tap = "tell me more").
 *
 * Pattern mirrors the existing AccoladeTile dialog in the Match Report:
 *   - Native showModal() for proper top-layer modal behaviour, focus
 *     trapping, and ESC dismissal — all for free, no library needed.
 *   - click-outside-to-close wired explicitly via a click handler on
 *     the dialog element (native <dialog> doesn't do this by default).
 *   - Close button in the corner for explicit dismissal.
 *
 * The component takes the currently-displayed weapon as a prop and an
 * `onClose` callback. The PARENT controls when the dialog is open —
 * we don't store an `isOpen` state here. This keeps the dialog "owned"
 * by the parent's gallery state (which already knows which gun was
 * second-tapped) and avoids divergent state.
 *
 * When `weapon` is null, the dialog is unmounted entirely. This is
 * fine because <dialog> elements survive being unmounted/remounted —
 * the alternative (keeping it mounted always and toggling .close())
 * would mean carrying around a "last opened weapon" so the dialog
 * has content during its closing transition. Simpler to just mount
 * fresh each time.
 */

type Props = {
  /** The weapon to show. When null, dialog isn't rendered. */
  weapon: Weapon | null;
  onClose: () => void;
};

export function WeaponDetailDialog({ weapon, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Open the dialog on mount via showModal(). Effect so it runs after
  // the dialog ref attaches. Cleanup closes on unmount in case the
  // parent unmounts us with the dialog still open (defensive).
  useEffect(() => {
    if (weapon === null) return;
    const d = dialogRef.current;
    if (!d) return;
    if (typeof d.showModal === "function" && !d.open) {
      d.showModal();
    }
    return () => {
      // Defensive close on unmount.
      if (d.open) d.close();
    };
  }, [weapon]);

  // Click-outside handling — clicking the dialog backdrop (the
  // <dialog> element itself, vs its content) closes. Native dialog
  // doesn't do this for free; we wire it up.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;

    function handleBackdropClick(e: MouseEvent) {
      if (!d) return;
      if (e.target === d) onClose();
    }
    function handleNativeClose() {
      // Fired when ESC is pressed or .close() is called. Notify parent
      // so it clears its "selected weapon for dialog" state.
      onClose();
    }

    d.addEventListener("click", handleBackdropClick);
    d.addEventListener("close", handleNativeClose);
    return () => {
      d.removeEventListener("click", handleBackdropClick);
      d.removeEventListener("close", handleNativeClose);
    };
  }, [onClose]);

  // Close handler for the explicit close button. Calls native .close()
  // which fires the "close" event, which calls onClose via the
  // listener above. Single source of truth for dismissal.
  function handleClose() {
    const d = dialogRef.current;
    if (d?.open) d.close();
    else onClose();
  }

  if (weapon === null) return null;

  return (
    <dialog
      ref={dialogRef}
      // Visual chrome:
      //   - rounded-sm + dark border + dark fill matches the rest of
      //     the player portal cards.
      //   - max-w-md w-[92vw] caps width at ~28rem on tablet/desktop
      //     while filling most of mobile viewport.
      //   - m-auto centres natively (margin: auto on a <dialog> that
      //     has been showModal()-opened works).
      //   - p-0 so the backdrop fills the entire element; padding
      //     lives on the inner content div.
      //   - backdrop:bg-bg/80 + backdrop:backdrop-blur-sm gives a
      //     soft tinted modal backdrop instead of pitch black.
      className="m-auto w-[92vw] max-w-md rounded-sm border border-border-strong bg-bg-elevated p-0 text-text backdrop:bg-bg/80 backdrop:backdrop-blur-sm"
    >
      <div className="p-5 sm:p-6">
        {/* Header: small "Weapon" eyebrow, gun name big, close X
            top-right. Mirrors the Accolade dialog visual hierarchy
            for consistency across the site's modals. */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-accent">
              Weapon
            </p>
            <h3 className="text-xl font-extrabold leading-tight tracking-tight text-text sm:text-2xl">
              {weapon.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            // Negative margins pull the X visually closer to the
            // corner without breaking the body padding.
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

        {/* Image. Yellow band background to match the gallery strip
            styling — gives the dialog brand continuity. py-4 inset so
            the gun has breathing room within the band. */}
        {weapon.imageUrl !== "" && (
          <div
            className="mt-4 flex items-center justify-center px-3 py-4 sm:py-5"
            style={{ backgroundColor: "#ffde00" }}
          >
            <img
              src={weapon.imageUrl}
              alt={weapon.name}
              className="block h-24 w-auto select-none object-contain sm:h-32"
              draggable={false}
            />
          </div>
        )}

        {/* Description body. Falls back to a soft "no description"
            placeholder if the sheet hasn't been filled in yet. We
            still render the dialog in that case so the user gets
            confirmed feedback that they tapped — better UX than
            silently doing nothing. */}
        {weapon.description !== "" ? (
          <p className="mt-4 text-sm leading-relaxed text-text-muted sm:text-base">
            {weapon.description}
          </p>
        ) : (
          <p className="mt-4 text-sm italic text-text-subtle">
            No description available yet.
          </p>
        )}

        {/* Quick stats restated for context inside the dialog so
            people don't have to mentally hold the gallery's panel
            in mind while reading the description. Compact 4-up row. */}
        <div className="mt-4 grid grid-cols-4 gap-1.5 border-t border-border pt-4">
          <DialogStat label="Mag" value={fmtNum(weapon.magSize)} />
          <DialogStat label="Dmg" value={fmtNum(weapon.damage)} />
          <DialogStat
            label="Reload"
            value={
              weapon.reloadSeconds > 0
                ? `${formatNumberShort(weapon.reloadSeconds)}s`
                : "—"
            }
          />
          <DialogStat label="Rate" value={formatFireRate(weapon.fireRate)} />
        </div>
      </div>
    </dialog>
  );
}

/* ---------- Inline tile inside the dialog ---------- */

/**
 * Smaller, more compact tile than the gallery's main StatTile. Used
 * as a "for context" recap inside the dialog.
 */
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

/* ---------- Number formatting (duplicated from stats panel for
   self-containment — small enough to not warrant a shared util) ---- */

function fmtNum(value: number): string {
  if (value === 0) return "—";
  return formatNumberShort(value);
}

function formatNumberShort(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(1).replace(/\.0$/, "");
}
