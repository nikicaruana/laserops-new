"use client";

/**
 * components/portal/BadgeDetailDialog.tsx
 * --------------------------------------------------------------------
 * Shared "what is this?" popup for accolade + streak badges, used by the match
 * report tiles AND the player-summary cards. The trigger wraps whatever badge/
 * card the caller renders; clicking opens a native <dialog> showing the big
 * badge on the LEFT (full height) with the name + description + a footer line on
 * the right. One place to style the popup for every surface.
 */
import { useEffect, useRef } from "react";
import { cldImage } from "@/lib/cld";
import { cn } from "@/lib/cn";

export function BadgeDetailDialog({
  kind,
  name,
  description,
  badgeUrl,
  footer,
  children,
  triggerClassName,
  ariaLabel,
}: {
  kind: string;
  name: string;
  description?: string | null;
  badgeUrl?: string | null;
  footer?: string | null;
  children: React.ReactNode;
  triggerClassName?: string;
  ariaLabel?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  function open() {
    const d = dialogRef.current;
    if (d && typeof d.showModal === "function") d.showModal();
  }
  function close() {
    const d = dialogRef.current;
    if (d?.open) d.close();
  }

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    function onBackdrop(e: MouseEvent) {
      if (d && e.target === d) d.close();
    }
    d.addEventListener("click", onBackdrop);
    return () => d.removeEventListener("click", onBackdrop);
  }, []);

  const desc = (description ?? "").trim();

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        }}
        aria-label={ariaLabel ?? `${name} - tap for details`}
        className={cn(
          "cursor-pointer rounded-sm transition-transform duration-150 active:scale-[0.98]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
          triggerClassName,
        )}
      >
        {children}
      </div>

      <dialog
        ref={dialogRef}
        className={cn(
          "rounded-sm portal-card text-text",
          "p-0 max-w-md w-[90vw] m-auto overflow-hidden",
          "backdrop:bg-bg/80 backdrop:backdrop-blur-sm",
        )}
      >
        <div className="relative flex">
          {/* Left: big badge, full vertical height of the popup. */}
          <div className="flex w-28 shrink-0 items-center justify-center bg-bg-overlay p-3 sm:w-36 sm:p-4">
            {badgeUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cldImage(badgeUrl, { w: 400 })} alt="" className="block h-auto w-full object-contain" />
            ) : (
              <span aria-hidden className="text-5xl text-text-subtle">&#9733;</span>
            )}
          </div>

          {/* Right: text. */}
          <div className="flex min-w-0 flex-1 flex-col justify-center p-5 pr-9 sm:p-6 sm:pr-11">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-accent">{kind}</p>
            <h3 className="mt-0.5 text-lg font-extrabold leading-tight tracking-tight text-text sm:text-xl">{name}</h3>
            {desc !== "" ? (
              <p className="mt-3 text-sm leading-relaxed text-text-muted sm:text-base">{desc}</p>
            ) : (
              <p className="mt-3 text-sm italic text-text-subtle">No description available yet.</p>
            )}
            {footer && <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-accent">{footer}</p>}
          </div>

          {/* Close. */}
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-2 top-2 p-1 text-text-muted transition-colors hover:text-text"
          >
            <svg aria-hidden viewBox="0 0 16 16" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>
      </dialog>
    </>
  );
}
