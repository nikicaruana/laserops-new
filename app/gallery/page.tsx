import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";
import { fetchGalleryPhotos } from "@/lib/match-photos";
import { GalleryBrowser } from "@/components/gallery/GalleryBrowser";

export const metadata: Metadata = {
  title: "Outdoor Laser Tag Gallery",
  alternates: { canonical: "/gallery" },
  description:
    "Photos from LaserOps Malta matches, events, and behind-the-scenes action.",
};

/**
 * /gallery
 * --------------------------------------------------------------------
 * Server component. Sourced from match-linked photos (match_photos joined to
 * their match), not a Cloudinary folder listing: every photo belongs to a game
 * and links to its report. The game / year / month / "my matches" filters are
 * applied client-side in GalleryBrowser.
 *
 * Empty state: fetchGalleryPhotos() returns [] on any error so the page renders
 * a non-alarming placeholder.
 */
export default async function GalleryPage() {
  const supabase = await createClient();
  const photos = await fetchGalleryPhotos(supabase);

  return (
    <main className="min-h-screen pb-16 pt-10 sm:pb-24 sm:pt-14 lg:pb-32 lg:pt-20">
      <Container size="wide">
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
            Every shot from every game. Filter by match, month, or just your own games.
          </p>
        </header>

        {photos.length === 0 ? <EmptyState /> : <GalleryBrowser photos={photos} />}
      </Container>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-sm portal-card p-8 text-center sm:p-12">
      <p className="text-base text-text-muted sm:text-lg">
        Gallery photos are on their way. Check back soon.
      </p>
    </div>
  );
}
