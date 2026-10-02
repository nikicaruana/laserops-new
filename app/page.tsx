import type { Metadata } from "next";
import { HomeHero } from "@/components/sections/HomeHero";
import { WeaponsSection } from "@/components/sections/WeaponsSection";
import { GallerySection } from "@/components/sections/GallerySection";
import { SeasonLeadersSection } from "@/components/home/SeasonLeadersSection";
import { GalleryPreview } from "@/components/gallery/GalleryPreview";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { brand } from "@/lib/brand";
import { getHomeHeroConfig } from "@/lib/cms/home-config";
import { getHomeSocialPosts, getHomeReviews } from "@/lib/cms/home-social";
import { SectionAmbient } from "@/components/layout/SectionAmbient";

/**
 * Homepage.
 *
 * All homepage content now comes from Supabase (off Google Sheets):
 *   - hero       -> home_config        (getHomeHeroConfig)
 *   - social     -> home_social_posts  (getHomeSocialPosts)
 *   - reviews    -> home_reviews       (getHomeReviews)
 * Each is read through the cookieless public client, so the page stays static /
 * ISR, and each has a built-in fallback so this never throws. Edited from
 * /admin/homepage. GallerySection falls back to its own sample data if social
 * and reviews are both empty.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [homeHero, socialPosts, reviews] = await Promise.all([
    getHomeHeroConfig(),
    getHomeSocialPosts(),
    getHomeReviews(),
  ]);

  // The review cards all link to the same Google destination – reuse the hero's
  // configured reviews URL (home_config) so there is a single source for it.
  const googleReviewsUrl = homeHero.reviewsUrl;

  const instagramItems = socialPosts.map((post, idx) => ({
    id: `social-${idx}`,
    imageSrc: post.imageUrl,
    caption: post.caption,
    postUrl: post.postUrl,
  }));

  const reviewItems = reviews.map((review, idx) => ({
    id: `review-${idx}`,
    rating: review.rating,
    quote: review.reviewText,
    reviewer: review.reviewerName,
    relativeTime: formatRelativeTime(review.date),
    reviewsUrl: googleReviewsUrl,
  }));

  return (
    <>
      <HomeHero config={homeHero} />
      <WeaponsSection />
      {/* Consecutive dark sections share ONE ambient so the bokeh is continuous
          across the section break. Both sit transparent over this group's dark
          base; the group collapses to nothing if both sections auto-hide. */}
      <div className="relative overflow-hidden bg-bg">
        <SectionAmbient tone="dark" />
        <div className="relative">
          <SeasonLeadersSection />
          {/* Cloudinary photo preview – shows up to 9 images tagged "featured". */}
          <GalleryPreview />
        </div>
      </div>
      <GallerySection
        instagramItems={instagramItems}
        reviewItems={reviewItems}
      />

      {/* ── Final CTA band ───────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-bg">
        <SectionAmbient tone="dark" />
        <Container className="relative py-24 text-center sm:py-32">
          <span className="eyebrow">Get Involved</span>
          <h2 className="mt-4 text-3xl font-extrabold text-text sm:text-4xl lg:text-5xl">
            Ready when you are.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-text-muted text-base sm:text-lg">
            Book a session or join our WhatsApp community to stay in the loop
            on upcoming events and games.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button href="/booking" variant="primary" size="lg">
              Book a Game →
            </Button>
            <Button
              href={brand.social.whatsapp || "/community"}
              variant="secondary"
              size="lg"
              {...(brand.social.whatsapp
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              Join our WhatsApp →
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}

/**
 * Coarse "X ago" formatter. Takes a YYYY-MM-DD string and returns
 * a casual relative time. Returns the raw string if it can't parse.
 */
function formatRelativeTime(yyyyMmDd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return yyyyMmDd;
  const reviewDate = new Date(yyyyMmDd + "T00:00:00Z");
  if (Number.isNaN(reviewDate.getTime())) return yyyyMmDd;

  const now = new Date();
  const diffMs = now.getTime() - reviewDate.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (days < 0) return yyyyMmDd; // future date – leave raw
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return "1 month ago";
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  if (days < 730) return "1 year ago";
  return `${Math.floor(days / 365)} years ago`;
}
