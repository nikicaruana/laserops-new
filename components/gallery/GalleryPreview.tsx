import Link from "next/link";
import { fetchGalleryImages } from "@/lib/cloudinary";
import { Container } from "@/components/ui/Container";

/**
 * GalleryPreview
 * --------------------------------------------------------------------
 * Homepage section. Async server component — fetches gallery images
 * (ISR-cached), filters to those tagged "featured", and renders up to
 * 9 in a compact 3-column masonry grid with a "View All Photos" CTA.
 *
 * Returns null silently when:
 *   - Cloudinary env vars are not configured
 *   - No images are tagged "featured"
 *
 * So the homepage degrades cleanly while the gallery is being set up.
 */

const MAX_PREVIEW = 9;

export async function GalleryPreview() {
  const allImages = await fetchGalleryImages();
  const featured = allImages
    .filter((img) => img.tags.includes("featured"))
    .slice(0, MAX_PREVIEW);

  // Nothing to show — render nothing rather than a broken/empty section.
  if (featured.length === 0) return null;

  return (
    <section className="border-t border-border bg-bg py-16 sm:py-20 lg:py-28">
      <Container size="wide">
        {/* Section header */}
        <div className="mb-8 sm:mb-10 lg:mb-12">
          <div className="flex items-center gap-3">
            <span aria-hidden className="block h-px w-8 bg-accent" />
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-accent sm:text-xs">
              Gallery
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-balance text-2xl font-extrabold leading-tight text-text sm:text-3xl lg:text-4xl">
              LaserOps in Action.
            </h2>
            <Link
              href="/gallery"
              className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-accent underline-offset-4 hover:underline"
            >
              View all photos →
            </Link>
          </div>
        </div>

        {/* Masonry grid — CSS columns, no JS */}
        <div className="columns-2 gap-3 sm:columns-3 sm:gap-4">
          {featured.map((img) => (
            <Link
              key={img.publicId}
              href="/gallery"
              className="group mb-3 block break-inside-avoid overflow-hidden rounded-sm sm:mb-4"
              aria-label={img.caption ?? "View photo in gallery"}
            >
              <img
                src={img.secureUrl}
                alt={img.caption ?? ""}
                width={img.width || undefined}
                height={img.height || undefined}
                loading="lazy"
                decoding="async"
                draggable={false}
                className="block w-full select-none object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            </Link>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-8 text-center sm:mt-10">
          <Link
            href="/gallery"
            className="inline-block rounded-sm border border-border px-6 py-3 text-xs font-bold uppercase tracking-[0.14em] text-text-muted transition-colors hover:border-accent hover:text-accent"
          >
            View Full Gallery
          </Link>
        </div>
      </Container>
    </section>
  );
}
