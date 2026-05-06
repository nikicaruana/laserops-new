import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { fetchGalleryImages } from "@/lib/cloudinary";
import { GalleryGrid } from "@/components/gallery/GalleryGrid";

export const metadata: Metadata = {
  title: "Gallery — LaserOps Malta",
  description:
    "Photos from LaserOps Malta matches, events, and behind-the-scenes action.",
};

/**
 * /gallery
 * --------------------------------------------------------------------
 * Server component. Fetches all Cloudinary images at request time
 * (ISR-cached for 30 min) and passes them to GalleryGrid.
 *
 * Empty state: fetchGalleryImages() returns [] on missing credentials
 * or any API error — the page renders a non-alarming placeholder.
 */

export default async function GalleryPage() {
  const images = await fetchGalleryImages();

  // Derive unique top-level folder names for the filter pills.
  // Preserve insertion order (first seen = first pill), then sort alpha.
  const folders = Array.from(new Set(images.map((img) => img.folder)))
    .filter(Boolean)
    .sort();

  return (
    <main className="min-h-screen bg-bg pb-16 pt-10 sm:pb-24 sm:pt-14 lg:pb-32 lg:pt-20">
      <Container size="wide">
        {/* Page heading */}
        <header className="mb-8 sm:mb-12 lg:mb-16">
          <div className="flex items-center gap-3">
            <span aria-hidden className="block h-px w-12 bg-accent" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Gallery
            </span>
          </div>
          <h1 className="mt-4 text-balance text-4xl font-extrabold leading-[1.05] text-text sm:text-5xl lg:text-6xl">
            LaserOps in Action.
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-text-muted sm:text-base">
            Moments from the arena — matches, events, and everything in between.
          </p>
        </header>

        {images.length === 0 ? (
          <EmptyState />
        ) : (
          <GalleryGrid images={images} folders={folders} />
        )}
      </Container>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-sm border border-border bg-bg-elevated p-8 text-center sm:p-12">
      <p className="text-base text-text-muted sm:text-lg">
        Gallery photos are on their way. Check back soon.
      </p>
    </div>
  );
}
