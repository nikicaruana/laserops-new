"use client";

import { useEffect, useRef, useState } from "react";
import type { Accolade } from "@/lib/cms/accolades";
import { cn } from "@/lib/cn";

/**
 * AccoladeTile
 * --------------------------------------------------------------------
 * One earned accolade in the match-report player stats card. The badge
 * image already includes the accolade name graphically, so we don't
 * render the name as redundant text — just the image and the XP label
 * (e.g. "+75 XP").
 *
 * Click/tap reveals a description popup. We use the native HTML <dialog>
 * element via showModal() — handles backdrop, focus management, ESC
 * dismiss, and accessibility for free.
 *
 * The tile is a button so keyboard navigation works (Enter/Space opens
 * the dialog), and the dialog itself includes a close button + click-
 * outside-to-close behaviour.
 */

export function AccoladeTile({ accolade }: { accolade: Accolade }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  function handleOpen() {
    const d = dialogRef.current;
    if (!d) return;
    // showModal opens the dialog as a top-layer modal with backdrop.
    // It also automatically traps focus and handles ESC dismiss.
    if (typeof d.showModal === "function") {
      d.showModal();
      setIsOpen(true);
    } else {
      // Fallback for environments that don't support <dialog>:
      // toggle visibility via state. Rare.
      setIsOpen(true);
    }
  }

  function handleClose() {
    const d = dialogRef.current;
    if (d?.open) d.close();
    setIsOpen(false);
  }

  // Click-outside handling: clicking on the dialog backdrop (the dialog
  // element itself, vs its content) closes the dialog. Native <dialog>
  // doesn't do this by default — we wire it up explicitly.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;

    function handleBackdropClick(e: MouseEvent) {
      if (!d) return;
      // The click target is the dialog element itself (i.e. the backdrop
      // area outside the inner content) when the user clicks outside.
      if (e.target === d) {
        d.close();
        setIsOpen(false);
      }
    }

    function handleNativeClose() {
      setIsOpen(false);
    }

    d.addEventListener("click", handleBackdropClick);
    d.addEventListener("close", handleNativeClose);
    return () => {
      d.removeEventListener("click", handleBackdropClick);
      d.removeEventListener("close", handleNativeClose);
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`${accolade.name} — tap for description`}
        // Bare button (no visible chrome) — the badge image is the
        // visual centerpiece. Active scale + ring on focus give
        // tactile/keyboard feedback. Ring uses an accent tint since
        // the surrounding container is dark.
        className={cn(
          "flex flex-col items-center gap-2 text-center",
          "transition-transform duration-150 active:scale-[0.97]",
          "rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
        )}
      >
        {/* Badge artwork sits directly on the dark section background.
            No wrapper box — the yellow-themed icon has natural
            contrast on black, so the previous inset-box treatment
            became redundant after we flipped the section to dark. */}
        {accolade.badgeUrl !== "" ? (
          <img
            src={accolade.badgeUrl}
            alt={accolade.name}
            loading="lazy"
            className="block h-32 w-32 object-contain sm:h-40 sm:w-40"
          />
        ) : (
          <span
            aria-hidden
            className="block h-32 w-32 sm:h-40 sm:w-40"
          />
        )}
        {/* XP label, in accent so it stays visible on dark. */}
        {accolade.xp > 0 && (
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-accent sm:text-sm">
            +{accolade.xp} XP
          </p>
        )}
      </button>

      {/* Description dialog. Native <dialog> element; ::backdrop is
          styled via global CSS or the inline backdrop:bg classes
          Tailwind v4 supports. We use a slightly tinted backdrop for
          a soft "modal" feel rather than a hard black. */}
      <dialog
        ref={dialogRef}
        // Tailwind classes targeting the dialog itself + its backdrop.
        // backdrop:bg-bg/80 = dark semi-transparent backdrop.
        // open:opacity-100 / opacity-0 with transition gives a fade-in.
        className={cn(
          "rounded-sm border border-border-strong bg-bg-elevated text-text",
          "p-0 max-w-sm w-[90vw]",
          // Native <dialog> needs explicit margin auto to center.
          "m-auto",
          // Backdrop styling
          "backdrop:bg-bg/80 backdrop:backdrop-blur-sm",
        )}
      >
        {/* Inner content — header + body. Padding inside the inner
            container, NOT on the dialog itself, so the backdrop fills
            the whole element. */}
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {accolade.badgeUrl !== "" && (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-bg-overlay p-1">
                  <img
                    src={accolade.badgeUrl}
                    alt=""
                    className="block h-full w-full object-contain"
                  />
                </div>
              )}
              <div className="flex flex-col">
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-accent">
                  Accolade
                </p>
                <h3 className="text-lg font-extrabold leading-tight tracking-tight text-text sm:text-xl">
                  {accolade.name}
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close"
              className="shrink-0 -mr-1 -mt-1 p-1 text-text-muted transition-colors hover:text-text"
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

          {accolade.description !== "" ? (
            <p className="mt-4 text-sm leading-relaxed text-text-muted sm:text-base">
              {accolade.description}
            </p>
          ) : (
            <p className="mt-4 text-sm italic text-text-subtle">
              No description available yet.
            </p>
          )}

          {accolade.xp > 0 && (
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-accent">
              +{accolade.xp} XP awarded
            </p>
          )}
        </div>
      </dialog>

      {/* Suppress unused-state warning — isOpen is tracked for future
          use (e.g. analytics on dialog opens). */}
      {isOpen && <span className="hidden" aria-hidden />}
    </>
  );
}
