"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

/**
 * HeaderInfoIcon
 * --------------------------------------------------------------------
 * A small "(i)" glyph rendered next to a column header label. Click
 * (mobile) or hover (desktop) reveals a small popover with explanatory
 * text — what does "Match Rating" mean, how is "ELO ±" computed, etc.
 *
 * Sits next to the label so it doesn't conflict with the column's
 * sort affordance (clicking the label sorts; clicking the icon
 * explains). Both desktop and mobile use the same hit target.
 *
 * Why this exists / when to use:
 *   Column names in stat tables are necessarily terse ("Acc%", "K/D",
 *   "ELO ±", "Rating"). Newer players don't always know what these
 *   mean. A tap-or-hover info icon next to the label is the standard
 *   stats-dashboard pattern (FBref, Basketball-Reference, Looker)
 *   and surfaces explanations on demand without crowding the header.
 *
 * --------------------------------------------------------------------
 * Implementation notes
 *
 * 1. Portal. The popover renders into `document.body` via React's
 *    `createPortal`. The header cell lives inside a sticky element
 *    inside an `overflow-hidden` outer container; rendering the
 *    popover inline would let those ancestors clip it. Portalling
 *    detaches it from the DOM tree visually while keeping the React
 *    component graph intact (so React state, focus, ARIA all work).
 *
 * 2. Positioning. Computed in absolute viewport coords from the
 *    icon's bounding rect on every open. We measure once on open
 *    (and on viewport resize while open) and pick a placement that
 *    keeps the popover fully on-screen:
 *      - Try below-left first (preferred).
 *      - If overflowing the right edge, flip to below-right.
 *      - If overflowing the bottom edge, flip vertically to above.
 *    No external positioning library — the rules are simple enough
 *    that 30 lines of measurement code does the job and avoids a
 *    floating-ui dependency.
 *
 * 3. Mobile hit area. Visual icon is ~14px so it stays unobtrusive
 *    next to compact column headers, but the clickable button extends
 *    to ~32px via padding + a slight negative margin on the host
 *    container, so the tap target meets accessibility guidelines
 *    without the visual inflating the row height.
 *
 * 4. Dismissal. Outside-click (pointerdown listener on document),
 *    Escape key, and a second click of the icon all close it. The
 *    popover itself is non-modal — no backdrop, no focus trap,
 *    nothing intrusive. It's an inline aside, not a dialog.
 *
 * 5. Hover behaviour. On devices with hover (desktop), pointer-enter
 *    on the icon also opens. We don't auto-close on pointer-leave
 *    immediately — there's a small grace period so the user can move
 *    their cursor onto the popover itself if they want to read it
 *    carefully. Click-outside still closes it.
 * --------------------------------------------------------------------
 */

type Props = {
  /** Tooltip text. Plain string for now; could become ReactNode later
   *  if we want to embed links or inline formatting. */
  tooltip: string;
  /** Optional aria-label override. Defaults to "More info". Pass a
   *  more specific label like "About Match Rating" when the column
   *  context isn't obvious from the surrounding label. */
  ariaLabel?: string;
};

/** Pixel offset from the icon to the popover. Small enough that the
 *  popover feels attached to the icon, not floating freely. */
const POPOVER_GAP = 6;

/** Approx popover width — used for clamp/flip calculations. The actual
 *  rendered popover uses max-w in CSS so it can be narrower if the
 *  text is short. */
const POPOVER_MAX_WIDTH = 240;

/** Margin between the popover and the viewport edge — never butts up
 *  flush against the screen edge on mobile. */
const VIEWPORT_PAD = 8;

/** Grace period (ms) before pointer-leave closes the popover on
 *  desktop. Lets users move from icon to popover without it
 *  disappearing en route. */
const HOVER_CLOSE_DELAY_MS = 120;

export function HeaderInfoIcon({ tooltip, ariaLabel }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    placement: "below" | "above";
  } | null>(null);
  const popoverId = useId();
  // Hover-close timeout handle — kept across renders so we can cancel
  // it if the pointer comes back into the icon/popover.
  const hoverCloseTimer = useRef<number | null>(null);

  // Recompute the popover position any time it opens, the viewport
  // resizes while it's open, or the user scrolls (the icon's screen
  // coords change). useLayoutEffect runs synchronously after DOM
  // mutations so the popover is positioned before the user can see
  // a flash at the wrong spot.
  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }

    function compute() {
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Preferred placement: below the icon, left edge aligned with
      // icon's left edge. This reads naturally for a column header
      // tooltip (text flows below the icon, doesn't cover the column
      // we're explaining).
      let left = rect.left;
      let top = rect.bottom + POPOVER_GAP;
      let placement: "below" | "above" = "below";

      // Right-edge clamp: if the popover would extend past the right
      // viewport edge, slide it leftward. If it still wouldn't fit,
      // anchor to the right edge of the icon instead.
      if (left + POPOVER_MAX_WIDTH > vw - VIEWPORT_PAD) {
        left = Math.max(VIEWPORT_PAD, vw - POPOVER_MAX_WIDTH - VIEWPORT_PAD);
      }

      // Bottom-edge flip: if there's not enough room below, render
      // above. Best-effort — we don't know the popover's actual
      // height before render, so we estimate ~120px (covers most
      // 1-3 line tooltips). If a particular tooltip is taller, the
      // popover's own max-height (in CSS below) prevents it from
      // overflowing.
      const estimatedHeight = 120;
      if (top + estimatedHeight > vh - VIEWPORT_PAD) {
        const aboveTop = rect.top - POPOVER_GAP - estimatedHeight;
        if (aboveTop > VIEWPORT_PAD) {
          top = aboveTop;
          placement = "above";
        }
        // If neither below nor above fully fits (very short viewport),
        // keep below — partial visibility beats off-screen.
      }

      setPosition({ top, left, placement });
    }

    compute();
    // Re-measure on resize/scroll while open. We listen on window
    // (resize) and window with capture (scroll, capture so we catch
    // scrolls in any ancestor scroll container).
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [isOpen]);

  // Outside-click + Escape to close. pointerdown (rather than click)
  // so the popover dismisses promptly on the press, not after the
  // release — feels snappier on mobile.
  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      // Click on the icon itself is handled by the button's own
      // toggle — let it through.
      if (buttonRef.current && buttonRef.current.contains(target)) return;
      // Click inside the popover doesn't close it (e.g. user
      // selecting text).
      if (popoverRef.current && popoverRef.current.contains(target)) return;
      setIsOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  // Cleanup any lingering hover-close timer on unmount, just in case
  // the component is removed mid-grace-period.
  useEffect(() => {
    return () => {
      if (hoverCloseTimer.current !== null) {
        window.clearTimeout(hoverCloseTimer.current);
      }
    };
  }, []);

  function cancelHoverClose() {
    if (hoverCloseTimer.current !== null) {
      window.clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
  }
  function scheduleHoverClose() {
    cancelHoverClose();
    hoverCloseTimer.current = window.setTimeout(() => {
      setIsOpen(false);
      hoverCloseTimer.current = null;
    }, HOVER_CLOSE_DELAY_MS);
  }

  // Stop propagation on the click — without this, the click would
  // bubble up to the parent header button and trigger a column sort
  // before opening the tooltip. We want sort and tooltip to be
  // independent affordances.
  function handleButtonClick(e: React.MouseEvent) {
    e.stopPropagation();
    setIsOpen((v) => !v);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        // Both onClick (works for mouse + touch) and pointer events
        // for the desktop hover behaviour.
        onClick={handleButtonClick}
        onPointerEnter={(e) => {
          // Only treat as hover-open on devices with a fine pointer
          // (mouse). Coarse pointers (touch) should rely on click.
          if (e.pointerType === "mouse") {
            cancelHoverClose();
            setIsOpen(true);
          }
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") scheduleHoverClose();
        }}
        aria-label={ariaLabel ?? "More info"}
        aria-expanded={isOpen}
        aria-controls={isOpen ? popoverId : undefined}
        // Larger hit area than the visual icon. The negative margin
        // keeps the icon's visual position tight against the
        // sibling label even though the button itself is bigger.
        className={cn(
          "inline-flex h-7 w-7 -my-1 items-center justify-center rounded-full",
          "text-text-subtle transition-colors",
          "hover:text-accent focus-visible:text-accent focus-visible:outline-none",
          isOpen && "text-accent",
        )}
      >
        <InfoIconSvg />
      </button>

      {isOpen && position !== null && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              id={popoverId}
              role="tooltip"
              onPointerEnter={cancelHoverClose}
              onPointerLeave={(e) => {
                if (e.pointerType === "mouse") scheduleHoverClose();
              }}
              style={{
                position: "fixed",
                top: position.top,
                left: position.left,
                maxWidth: POPOVER_MAX_WIDTH,
              }}
              className={cn(
                "z-50",
                // Visual chrome: matches the chart tooltip style for
                // consistency across the player portal.
                "rounded-sm border border-border-strong bg-bg-overlay px-3 py-2 shadow-lg",
                // Yellow accent strip on top so the popover visually
                // ties to the rest of the brand chrome.
                "border-t-2 border-t-accent",
                // Text styling: small, normal-case (not uppercase like
                // headers) so it reads as prose rather than a label.
                "text-xs leading-snug text-text",
                // Cap height with internal scroll for very long copy
                // — shouldn't happen with good tooltip writing but
                // defensive.
                "max-h-[12rem] overflow-auto",
              )}
            >
              {tooltip}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/**
 * Small inline SVG for the (i) glyph. Inline (rather than imported
 * from a library) because it's a single 14px icon — adding lucide-react
 * just for this would be a big dependency for a small thing, and we
 * don't currently import lucide elsewhere on the History page.
 *
 * If we do start using lucide more widely, swap this for
 * <Info size={14} /> from lucide-react.
 */
function InfoIconSvg() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
