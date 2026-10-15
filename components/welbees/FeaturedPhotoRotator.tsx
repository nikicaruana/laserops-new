"use client";

/**
 * components/welbees/FeaturedPhotoRotator.tsx
 * --------------------------------------------------------------------
 * Three square tiles that cross-fade through the featured gallery photos on the
 * Welbee's offer landing page. All photos are stacked per tile and toggled by
 * opacity (cheap, smooth), advancing one step every few seconds. Freezes under
 * prefers-reduced-motion and when there are three or fewer photos.
 */
import { useEffect, useState } from "react";

export function FeaturedPhotoRotator({ photos }: { photos: string[] }) {
  const n = photos.length;
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (n <= 3) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setOffset((o) => (o + 1) % n), 3800);
    return () => clearInterval(id);
  }, [n]);

  if (n === 0) return null;
  const tiles = [0, 1, 2];

  return (
    <div className="mt-3.5 grid grid-cols-3 gap-2.5">
      {tiles.map((t) => {
        const active = ((offset + t) % n + n) % n;
        return (
          <div key={t} className="relative aspect-square overflow-hidden rounded-[4px] border border-border bg-bg-elevated">
            {photos.map((src, idx) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={idx}
                src={src}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${idx === active ? "opacity-100" : "opacity-0"}`}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
