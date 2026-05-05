"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Weapon } from "@/lib/cms/weapons";
import { WeaponStatsPanel, type StatWinners } from "./WeaponStatsPanel";
import { WeaponDetailDialog } from "./WeaponDetailDialog";

/**
 * WeaponGallery
 * --------------------------------------------------------------------
 * Self-contained gallery: gun-tree dropdown filter + horizontal
 * scroll-snap row of weapons + stats panel for the centred gun.
 *
 * Each instance owns its own selectedTree state — so in compare mode
 * the two galleries can show different trees independently.
 *
 * --------------------------------------------------------------------
 * NEW IN PASS 15
 *
 * 1. Film-reel strip. The yellow background that was per-card is now
 *    a single continuous yellow band stretched across the full
 *    scrollable content width. Gun images sit on top of it without
 *    their own card chrome. As the user scrolls, the entire strip
 *    moves — like a film reel passing under a fixed window. The
 *    centred gun is highlighted by a centred "viewer" overlay
 *    (subtle dark inset) that stays put while the strip moves.
 *
 *    Why this works: scroll-snap-align: center on each gun slot
 *    keeps the snapping behaviour identical. The strip is rendered
 *    inside the scroller as one continuous flex row of slots; the
 *    yellow background is on the wrapper that contains all slots,
 *    so it spans the full content width naturally without needing
 *    per-card colouring.
 *
 *    Centred-card detection is unchanged (IntersectionObserver on
 *    each slot relative to the scroller's centre band).
 *
 * 2. Inverted layout is now a TRUE MIRROR of the default. Order
 *    flips for the bottom gallery in compare mode:
 *
 *      Default (gallery A):
 *        filter → strip → name → tiles
 *
 *      Inverted (gallery B):
 *        tiles → name → strip → filter
 *
 *    The names and filter dropdowns sit symmetrically around the
 *    centre VS divider, with the two yellow strips at the outer
 *    edges of the comparison.
 * --------------------------------------------------------------------
 */

type Props = {
  allWeapons: Weapon[];
  treeBranches: string[];
  ariaLabel: string;
  statsAriaLabel?: string;
  initialTree?: string;
  inverted?: boolean;
  hideStatsSecondary?: boolean;
  winners?: StatWinners | null;
  onCenteredChange?: (weapon: Weapon | null) => void;
};

const FILTER_ALL = "all";

export function WeaponGallery({
  allWeapons,
  treeBranches,
  ariaLabel,
  statsAriaLabel,
  initialTree = FILTER_ALL,
  inverted,
  hideStatsSecondary,
  winners,
  onCenteredChange,
}: Props) {
  const [selectedTree, setSelectedTree] = useState<string>(initialTree);

  const weapons = useMemo<Weapon[]>(() => {
    if (selectedTree === FILTER_ALL) return allWeapons;
    return allWeapons.filter((w) => w.treeBranch === selectedTree);
  }, [allWeapons, selectedTree]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const [centeredName, setCenteredName] = useState<string | null>(
    weapons[0]?.name ?? null,
  );

  // Dialog state — when non-null, the WeaponDetailDialog renders open
  // for that weapon. Cleared when the user closes the dialog (via X,
  // ESC, or click-outside).
  //
  // Why state rather than just deriving from "tapped centred card":
  // the user could centre a gun via swipe + then tap to open the
  // dialog, OR tap an already-centred gun directly. We need a single
  // source of truth for "which gun's dialog is currently open" and
  // store it explicitly.
  const [dialogWeapon, setDialogWeapon] = useState<Weapon | null>(null);

  useEffect(() => {
    if (weapons.length === 0) {
      setCenteredName(null);
      return;
    }
    setCenteredName(weapons[0].name);
    const firstCard = cardRefs.current.get(weapons[0].name);
    if (firstCard) {
      firstCard.scrollIntoView({
        behavior: "auto",
        inline: "center",
        block: "nearest",
      });
    }
  }, [weapons]);

  useEffect(() => {
    if (!onCenteredChange) return;
    const w = weapons.find((x) => x.name === centeredName) ?? null;
    onCenteredChange(w);
  }, [centeredName, weapons, onCenteredChange]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    if (weapons.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let best: { name: string; ratio: number } | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const name =
            (entry.target as HTMLElement).dataset.weaponName ?? "";
          if (name === "") continue;
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { name, ratio: entry.intersectionRatio };
          }
        }
        if (best) setCenteredName(best.name);
      },
      {
        root: scroller,
        rootMargin: "0px -49% 0px -49%",
        threshold: [0, 0.01, 0.5, 1],
      },
    );

    for (const el of cardRefs.current.values()) {
      observer.observe(el);
    }
    return () => observer.disconnect();
  }, [weapons]);

  // Click/tap behaviour is two-stage:
  //   1. If the clicked card is NOT already centred → scroll it into
  //      the centre (focus). User is exploring the gallery.
  //   2. If the clicked card IS already centred → open the detail
  //      dialog. User has confirmed interest in this specific gun.
  //
  // This mirrors the iOS App Store / iOS Photos pattern: first tap
  // focuses, second tap commits. Avoids the conflict between
  // "scrolling around to look" and "opening a popup."
  //
  // Keyboard: Enter on a focused card hits this same handler, so
  // Enter on a non-centred card focuses, Enter on the centred card
  // opens the dialog. Same UX.
  const handleCardClick = useCallback(
    (name: string) => {
      if (name === centeredName) {
        // Second-tap: open the dialog. Look up the weapon — this
        // handler closes over `weapons` via the dependency array,
        // so the lookup will always reflect the current filtered list.
        const w = weapons.find((x) => x.name === name) ?? null;
        if (w) setDialogWeapon(w);
        return;
      }
      // First-tap: scroll into centre.
      const el = cardRefs.current.get(name);
      if (el) {
        el.scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        });
      }
    },
    [centeredName, weapons],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (weapons.length === 0) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const idx = weapons.findIndex((w) => w.name === centeredName);
      if (idx === -1) return;
      const nextIdx =
        e.key === "ArrowRight"
          ? Math.min(idx + 1, weapons.length - 1)
          : Math.max(idx - 1, 0);
      const nextName = weapons[nextIdx].name;
      handleCardClick(nextName);
    },
    [weapons, centeredName, handleCardClick],
  );

  const centeredWeapon = useMemo<Weapon | null>(
    () => weapons.find((w) => w.name === centeredName) ?? null,
    [weapons, centeredName],
  );

  /* ---------- Building blocks for both layouts ---------- */

  const filterBlock = (
    <TreeFilter
      value={selectedTree}
      onChange={setSelectedTree}
      options={treeBranches}
    />
  );

  const stripBlock =
    weapons.length === 0 ? (
      <div className="rounded-sm border border-border bg-bg-elevated p-6 text-center">
        <p className="text-sm text-text-muted">
          No weapons in this tree. Try a different filter.
        </p>
      </div>
    ) : (
      // Wrapper provides the centred-slot indicator overlay. The
      // overlay sits absolutely positioned over the centre of the
      // scroll container, providing the "viewer window" of the film
      // reel — a thin outline that frames whatever gun is currently
      // centred. The strip (the yellow band with guns) scrolls
      // beneath it.
      <div className="relative">
        {/* Centred slot indicator. Doesn't capture pointer events
            (pointer-events-none) so swipes through it still scroll
            the gallery beneath. The centred gun naturally appears
            inside this frame because of scroll-snap. */}
        <CenteredSlotFrame />

        <div
          ref={scrollerRef}
          role="region"
          aria-label={ariaLabel}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          // overflow-x-auto with snap — same scrolling behaviour as
          // before. py removed; the strip itself provides vertical
          // height now. touch-pan-x for native horizontal panning.
          className="scrollbar-none flex w-full snap-x snap-mandatory items-stretch overflow-x-auto touch-pan-x [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {/* Leading spacer — pushes first slot to centre on scroll=0. */}
          <div aria-hidden className="shrink-0" style={{ width: "50%" }} />

          {/* Film strip wrapper. THIS element provides the continuous
              yellow background that all gun slots share. The wrapper
              is a flex row of slots; its background is yellow, and
              its width is the sum of slot widths (plus gaps). As
              the scroller scrolls, the entire strip translates as
              one unit visually.
              The strip also has subtle perforation-style top/bottom
              borders (darker yellow stripes) to evoke film reel
              edges. */}
          <div
            className="relative flex shrink-0 items-stretch"
            style={{
              backgroundColor: "#ffde00",
              // Top + bottom darker bands evoke film-reel sprocket
              // strip without needing extra DOM nodes. They're
              // implemented as inline gradient stripes on the bg.
              // ~6% alpha black, 4px thick, top + bottom.
              backgroundImage:
                "linear-gradient(to bottom, rgba(0,0,0,0.18) 0, rgba(0,0,0,0.18) 4px, transparent 4px, transparent calc(100% - 4px), rgba(0,0,0,0.18) calc(100% - 4px), rgba(0,0,0,0.18) 100%)",
            }}
          >
            {weapons.map((weapon) => {
              const isCentered = weapon.name === centeredName;
              return (
                <button
                  key={weapon.name}
                  type="button"
                  ref={(el) => {
                    if (el) cardRefs.current.set(weapon.name, el);
                    else cardRefs.current.delete(weapon.name);
                  }}
                  data-weapon-name={weapon.name}
                  onClick={() => handleCardClick(weapon.name)}
                  aria-label={`View ${weapon.name} stats`}
                  aria-pressed={isCentered}
                  // Each slot is fixed-width, snap-aligned to centre.
                  // No background colour on the button — the parent
                  // strip provides the yellow.
                  // py-3 sm:py-4 lg:py-5 gives vertical breathing
                  // room around the gun image. The image itself
                  // determines the slot height implicitly.
                  className="flex shrink-0 snap-center items-center justify-center px-3 py-3 transition-all duration-300 ease-out sm:px-4 sm:py-4 lg:px-5 lg:py-5"
                  style={{
                    // Centred gun: full size + opacity. Non-centred:
                    // scale down + dim slightly. The dim is gentler
                    // than before (0.6 vs 0.5) because on a yellow
                    // bg, a heavily dimmed image becomes hard to
                    // see — the gun silhouette gets washed out.
                    opacity: isCentered ? 1 : 0.6,
                    transform: isCentered ? "scale(1)" : "scale(0.85)",
                  }}
                >
                  {/* Slot inner — fixed dimensions for the gun image
                      only. The yellow card chrome is gone (provided
                      by the strip); only the image remains. */}
                  <div className="flex h-20 w-32 items-center justify-center sm:h-28 sm:w-44 lg:h-32 lg:w-56">
                    {weapon.imageUrl !== "" ? (
                      <img
                        src={weapon.imageUrl}
                        alt={weapon.name}
                        loading="lazy"
                        draggable={false}
                        className="block max-h-full max-w-full select-none object-contain"
                      />
                    ) : (
                      <span className="px-2 text-center text-xs font-bold uppercase tracking-wider text-bg">
                        {weapon.name}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Trailing spacer — lets the last slot reach the centre. */}
          <div aria-hidden className="shrink-0" style={{ width: "50%" }} />
        </div>
      </div>
    );

  const statsBlock = (
    <WeaponStatsPanel
      weapon={centeredWeapon}
      ariaLabel={statsAriaLabel}
      hideSecondary={hideStatsSecondary}
      inverted={inverted}
      winners={winners ?? null}
    />
  );

  /* ---------- Layout assembly: default vs inverted ---------- */

  // Inverted = exact mirror of default.
  //
  //   Default order (top-to-bottom):     filter → strip → stats(name+tiles)
  //   Inverted order (top-to-bottom):    stats(tiles+name) → strip → filter
  //
  // The stats panel itself flips its own internal order via the
  // `inverted` prop (tiles before name) so the names sit symmetrically
  // adjacent to the centre divider when both galleries are stacked.
  //
  // Detail dialog is rendered alongside both layouts — it's a
  // top-layer modal anyway (via showModal()), so its position in
  // the DOM is irrelevant visually.
  if (inverted) {
    return (
      <>
        <div className="flex flex-col gap-3 sm:gap-4">
          {statsBlock}
          {stripBlock}
          {filterBlock}
        </div>
        <WeaponDetailDialog
          weapon={dialogWeapon}
          onClose={() => setDialogWeapon(null)}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:gap-4">
        {filterBlock}
        {stripBlock}
        {statsBlock}
      </div>
      <WeaponDetailDialog
        weapon={dialogWeapon}
        onClose={() => setDialogWeapon(null)}
      />
    </>
  );
}

/* ---------- Centred-slot frame (film-reel "viewer") ---------- */

/**
 * The fixed viewing frame at the centre of the scroller. Two thin
 * vertical lines mark the left + right edges of the centred slot,
 * evoking a film-projector gate or slot-machine reel viewer.
 *
 * Width matches the slot width inside the strip (h-20 w-32 mobile,
 * h-28 w-44 sm, h-32 w-56 lg) — kept in sync via the same Tailwind
 * size classes.
 *
 * Pointer-events-none so the user's swipes pass through to the
 * scroller below.
 */
function CenteredSlotFrame() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
    >
      <div className="h-20 w-32 border-x-2 border-bg/30 sm:h-28 sm:w-44 lg:h-32 lg:w-56" />
    </div>
  );
}

/* ---------- Tree filter dropdown ---------- */

function TreeFilter({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (next: string) => void;
  options: string[];
}) {
  return (
    <label className="flex flex-col items-center gap-1.5">
      <span className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-text-muted">
        Gun Tree
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block min-w-[200px] cursor-pointer rounded-sm border border-border bg-bg-elevated px-3 py-2 text-center text-sm font-semibold text-text transition-colors hover:border-border-strong focus-visible:border-accent focus-visible:outline-none"
      >
        <option value={FILTER_ALL}>All Weapons</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}
