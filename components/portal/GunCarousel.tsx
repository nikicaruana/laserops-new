"use client";

/**
 * components/portal/GunCarousel.tsx
 * --------------------------------------------------------------------
 * Horizontally-scrollable gun picker: each unlocked gun on a yellow tile with
 * its image (echoing /weapons). Tap to select; the chosen tile gets an accent
 * ring. Used when booking a gun at signup and when joining a live match.
 */
import { cn } from "@/lib/cn";

export type CarouselGun = { name: string; label: string; img: string | null };

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
        return (
          <button
            key={g.name}
            type="button"
            onClick={() => onChange(g.name)}
            aria-pressed={selected}
            className={cn(
              "group w-28 shrink-0 snap-start overflow-hidden border-2 text-left transition-colors",
              selected ? "border-accent" : "border-transparent hover:border-border-strong",
            )}
          >
            <div className="relative flex aspect-square items-center justify-center bg-accent p-2">
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
            </div>
            <p
              className={cn(
                "truncate px-1.5 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.06em]",
                selected ? "bg-accent/15 text-accent" : "text-text-muted",
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
