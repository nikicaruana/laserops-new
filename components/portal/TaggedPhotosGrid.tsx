"use client";

/**
 * components/portal/TaggedPhotosGrid.tsx
 * --------------------------------------------------------------------
 * Grid of photos a player is tagged in, for the profile Photos section. Shows a
 * capped number by default with a "View all" toggle to reveal the rest. Each
 * photo links to its match report. Square tiles (circles are for squad logos).
 */
import { useState } from "react";
import { cldImage } from "@/lib/cld";
import Link from "next/link";
import type { PlayerTaggedPhoto } from "@/lib/match-photos";

export function TaggedPhotosGrid({
  photos,
  opsTag,
  limit = 6,
}: {
  photos: PlayerTaggedPhoto[];
  opsTag: string;
  limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  if (photos.length === 0) {
    return (
      <div className="flex min-h-[8rem] items-center justify-center border border-dashed border-border bg-bg-elevated px-4 py-8 text-center">
        <p className="text-sm text-text-subtle">
          No tagged photos yet. When {opsTag} is tagged in match photos, they show up here.
        </p>
      </div>
    );
  }

  const shown = expanded ? photos : photos.slice(0, limit);
  const hiddenCount = photos.length - limit;

  return (
    <div className="border border-border bg-bg-elevated p-4">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {shown.map((p) => {
          const img = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cldImage(p.url, { w: 400 })}
              alt={p.caption ?? `Photo of ${opsTag}`}
              className="aspect-square h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
              loading="lazy"
            />
          );
          return (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-sm border border-border bg-bg">
              {p.matchCode ? (
                <Link
                  href={`/match-report?match=${encodeURIComponent(p.matchCode)}&player=${encodeURIComponent(opsTag)}`}
                  className="block h-full w-full"
                  aria-label="View the match this photo is from"
                >
                  {img}
                </Link>
              ) : (
                img
              )}
            </div>
          );
        })}
      </div>

      {!expanded && hiddenCount > 0 && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="border border-border-strong px-5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-text-muted transition-colors hover:border-accent hover:text-accent"
          >
            View all {photos.length}
          </button>
        </div>
      )}
    </div>
  );
}
