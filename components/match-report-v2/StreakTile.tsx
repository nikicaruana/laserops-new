"use client";

import { useEffect, useRef, useState } from "react";
import type { MatchStreak } from "@/lib/match-report-v2/report-types";
import { cn } from "@/lib/cn";

/**
 * StreakTile
 * --------------------------------------------------------------------
 * One streak a player earned in the match. Shows the streak badge + its point
 * value; tap/click opens a native <dialog> describing what it is. Mirrors
 * AccoladeTile's pattern (backdrop, focus, ESC, click-outside).
 */
export function StreakTile({ streak }: { streak: MatchStreak }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  function handleOpen() {
    const d = dialogRef.current;
    if (!d) return;
    if (typeof d.showModal === "function") {
      d.showModal();
      setIsOpen(true);
    } else {
      setIsOpen(true);
    }
  }
  function handleClose() {
    const d = dialogRef.current;
    if (d?.open) d.close();
    setIsOpen(false);
  }

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    function onBackdrop(e: MouseEvent) {
      if (d && e.target === d) {
        d.close();
        setIsOpen(false);
      }
    }
    function onNativeClose() {
      setIsOpen(false);
    }
    d.addEventListener("click", onBackdrop);
    d.addEventListener("close", onNativeClose);
    return () => {
      d.removeEventListener("click", onBackdrop);
      d.removeEventListener("close", onNativeClose);
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`${streak.name} – tap for description`}
        className={cn(
          "flex flex-col items-center gap-0 text-center sm:gap-1.5",
          "transition-transform duration-150 active:scale-[0.97]",
          "rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
        )}
      >
        <span className="relative">
          {streak.badgeUrl !== "" ? (
            <img src={streak.badgeUrl} alt={streak.name} loading="lazy" className="block h-24 w-24 object-contain sm:h-28 sm:w-28" />
          ) : (
            <span aria-hidden className="flex h-24 w-24 items-center justify-center border border-border text-[0.6rem] uppercase text-text-subtle sm:h-28 sm:w-28">{streak.name}</span>
          )}
          {streak.count > 1 && (
            <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full border border-bg bg-accent px-1.5 text-[0.65rem] font-extrabold text-bg">
              ×{streak.count}
            </span>
          )}
        </span>
        {streak.points > 0 && <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.12em] text-accent">+{streak.points * streak.count}</p>}
      </button>

      <dialog
        ref={dialogRef}
        className={cn(
          "rounded-sm border border-border-strong bg-bg-elevated text-text",
          "p-0 max-w-sm w-[90vw] m-auto",
          "backdrop:bg-bg/80 backdrop:backdrop-blur-sm",
        )}
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {streak.badgeUrl !== "" && (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-bg-overlay p-1">
                  <img src={streak.badgeUrl} alt="" className="block h-full w-full object-contain" />
                </div>
              )}
              <div className="flex flex-col">
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-accent">Streak</p>
                <h3 className="text-lg font-extrabold leading-tight tracking-tight text-text sm:text-xl">{streak.name}</h3>
              </div>
            </div>
            <button type="button" onClick={handleClose} aria-label="Close" className="-mr-1 -mt-1 shrink-0 p-1 text-text-muted transition-colors hover:text-text">
              <svg aria-hidden viewBox="0 0 16 16" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>
          </div>
          {streak.description !== "" ? (
            <p className="mt-4 text-sm leading-relaxed text-text-muted sm:text-base">{streak.description}</p>
          ) : (
            <p className="mt-4 text-sm italic text-text-subtle">No description available yet.</p>
          )}
          {streak.points > 0 && <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-accent">+{streak.points} points</p>}
        </div>
      </dialog>
      {isOpen && <span className="hidden" aria-hidden />}
    </>
  );
}
