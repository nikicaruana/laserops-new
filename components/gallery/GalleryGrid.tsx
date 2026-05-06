"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { CloudinaryImage } from "@/lib/cloudinary";
import { GalleryLightbox } from "./GalleryLightbox";

/**
 * GalleryGrid
 * --------------------------------------------------------------------
 * Masonry grid of Cloudinary images. Client component so it can manage
 * filter state, lightbox state, and IntersectionObserver fade-ins.
 *
 * Layout: CSS `columns-2 sm:columns-3 lg:columns-4` with
 * `break-inside-avoid` — true masonry without a JS layout library.
 *
 * Filter pills: shown only when there are multiple top-level folders.
 * Inactive images stay mounted (display:none via className) so the
 * masonry columns don't re-flow on filter change.
 *
 * Lightbox: GalleryLightbox receives the full image list and the index
 * of the clicked image.
 */

type Props = {
  images: CloudinaryImage[];
  /** Unique folder names derived from publicIds, pre-sorted. */
  folders: string[];
};

export function GalleryGrid({ images, folders }: Props) {
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const showPills = folders.length > 1;

  // Build the subset used for the lightbox — only the currently-visible
  // images, so the counter reflects "3 of 14 visible" not "3 of 50 total".
  const visibleImages =
    activeFolder === "all"
      ? images
      : images.filter((img) => img.folder === activeFolder);

  return (
    <>
      {/* Filter pills */}
      {showPills && (
        <div className="mb-6 flex flex-wrap gap-2 sm:mb-8">
          <FilterPill
            label="All"
            active={activeFolder === "all"}
            onClick={() => setActiveFolder("all")}
          />
          {folders.map((f) => (
            <FilterPill
              key={f}
              label={folderLabel(f)}
              active={activeFolder === f}
              onClick={() => setActiveFolder(f)}
            />
          ))}
        </div>
      )}

      {/* Masonry grid */}
      <div className="columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4 lg:gap-5">
        {visibleImages.map((img, i) => (
          <GalleryItem
            key={img.publicId}
            image={img}
            index={i}
            onClick={() => setLightboxIndex(i)}
          />
        ))}
      </div>

      {/* Lightbox */}
      <GalleryLightbox
        images={visibleImages}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// GalleryItem
// ---------------------------------------------------------------------------

type ItemProps = {
  image: CloudinaryImage;
  index: number;
  onClick: () => void;
};

function GalleryItem({ image, index, onClick }: ItemProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [inView, setInView] = useState(false);

  // Fade-in once when the item crosses 10% into the viewport.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            obs.disconnect();
            break;
          }
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Stagger up to 12 items per "row" of columns.
  const delay = `${(index % 12) * 50}ms`;

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={cn(
        "gallery-item group mb-3 block w-full break-inside-avoid overflow-hidden rounded-sm sm:mb-4 lg:mb-5",
        "relative cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        // Fade + slight lift on enter.
        "translate-y-2 opacity-0 transition-[opacity,transform] duration-500",
        inView && "translate-y-0 opacity-100",
      )}
      style={{ transitionDelay: inView ? delay : "0ms" }}
      aria-label={image.caption ?? "View photo"}
    >
      <img
        src={image.secureUrl}
        alt={image.caption ?? ""}
        width={image.width || undefined}
        height={image.height || undefined}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="block w-full select-none object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />
      {/* Hover overlay — caption */}
      {image.caption && (
        <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-black/0 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
          <p className="line-clamp-2 text-left text-xs font-semibold leading-snug text-white/90">
            {image.caption}
          </p>
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// FilterPill
// ---------------------------------------------------------------------------

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-sm border px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.14em] transition-colors",
        active
          ? "border-accent bg-accent text-bg"
          : "border-border text-text-muted hover:border-border-strong hover:text-text",
      )}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a Cloudinary folder path into a readable pill label.
 *
 * Handles the project's naming convention: "open_match_2026-04-23"
 * → "Open Match · 23 Apr 2026". Any trailing YYYY-MM-DD is detected
 * and formatted as a locale date; the prefix is title-cased.
 * Falls back to simple capitalisation for non-date folder names.
 */
function folderLabel(folder: string): string {
  const last = folder.split("/").at(-1) ?? folder;

  // Detect a trailing ISO date: some-prefix_YYYY-MM-DD
  const dateMatch = last.match(/^(.*?)[-_]?(\d{4}-\d{2}-\d{2})$/);
  if (dateMatch) {
    const prefix = (dateMatch[1] ?? "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
    // Parse as UTC midnight to avoid timezone shifts flipping the day.
    const [y, m, d] = (dateMatch[2] ?? "").split("-").map(Number);
    const date = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1));
    const formatted = date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
    return prefix ? `${prefix} · ${formatted}` : formatted;
  }

  return last.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
