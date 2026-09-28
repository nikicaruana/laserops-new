"use client";

/**
 * components/portal/GunCarousel.tsx
 * --------------------------------------------------------------------
 * Horizontally-scrollable gun picker: each unlocked gun on a yellow tile with
 * its image (echoing /weapons). Tap to select; the chosen tile gets an accent
 * ring. Used when booking a gun at signup and when joining a live match.
 */
import { cn } from "@/lib/cn";

export type CarouselGun = { name: string; label: string; img: string | null; soldOut?: boolean };

export function GunCarousel({
  guns,
  value,
  onChange,
}: {
  guns: CarouselGun[];
  value: string;
  onChange: (name: string) => void;
}) {
  if (guns.length === 0) {
    return <p className="text-sm text-text-subtle">No unlocked guns found on your account.</p>;
  }

  return (
    <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
      {guns.map((g) => {
        const selected = value === g.name;
        const soldOut = g.soldOut && !selected;
        return (
          <button
            key={g.name}
            type="button"
            onClick={() => !soldOut && onChange(g.name)}
            disabled={soldOut}
            aria-pressed={selected}
            aria-disabled={soldOut}
            className={cn(
              "group w-36 shrink-0 snap-start overflow-hidden border-2 text-left transition-colors",
              selected ? "border-accent" : soldOut ? "cursor-not-allowed border-transparent" : "border-transparent hover:border-border-strong",
            )}
          >
            <div className={cn("relative flex aspect-square items-center justify-center bg-accent p-2", soldOut && "opacity-40")}>
              {g.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.img} alt="" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="px-1 text-center text-[0.7rem] font-bold uppercase text-bg">{g.label}</span>
              )}
              {selected && (
                <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-bg text-[0.7rem] font-bold text-accent">
                  ✓
                </span>
              )}
              {soldOut && (
                <span className="absolute inset-x-0 bottom-0 bg-bg/85 py-1 text-center text-[0.6rem] font-bold uppercase tracking-[0.1em] text-red-400">
                  Fully booked
                </span>
              )}
            </div>
            <p
              className={cn(
                "line-clamp-2 min-h-[2.4rem] px-2 py-1.5 text-[0.7rem] font-semibold uppercase leading-tight tracking-[0.04em]",
                selected ? "bg-accent/15 text-accent" : soldOut ? "text-text-subtle" : "text-text-muted",
              )}
            >
              {g.label}
            </p>
          </button>
        );
      })}
    </div>
  );
}
