import type { Metadata } from "next";
import { HomeHero } from "@/components/sections/HomeHero";
import { WeaponsSection } from "@/components/sections/WeaponsSection";
import { GallerySection } from "@/components/sections/GallerySection";
import { SeasonLeadersSection } from "@/components/home/SeasonLeadersSection";
import { GalleryPreview } from "@/components/gallery/GalleryPreview";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { brand } from "@/lib/brand";
import { fetchInstagramPosts } from "@/lib/cms/instagram-posts";
import { fetchGoogleReviews } from "@/lib/cms/google-reviews";
import { fetchSiteConfig, configString } from "@/lib/cms/site-config";
import { getHomeHeroConfig } from "@/lib/cms/home-config";
import { SectionAmbient } from "@/components/layout/SectionAmbient";

/**
 * Homepage.
 *
 * Server-side fetches CMS data for the hero + GallerySection, transforms it
 * into the shapes those components expect, and passes it as props. The hero
 * content comes from Supabase (home_config) via getHomeHeroConfig; editing it
 * lives at /admin/homepage. The gallery/review CMS data still flows from the
 * Sheets-backed fetchers until those areas are migrated too.
 *
 * If a fetch returns no data, each component falls back to its baked-in sample
 * / default – the homepage always stays meaningful.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  // Fetch CMS data in parallel. Each has built-in fallback so this
  // never throws.
  const [instagramPosts, googleReviews, siteConfig, homeHero] = await Promise.all([
    fetchInstagramPosts(),
    fetchGoogleReviews(),
    fetchSiteConfig(),
    getHomeHeroConfig(),
  ]);

  // Resolve the Google Reviews link from Site_Config for the review cards in
  // GallerySection. (The hero's own reviews link comes from home_config.)
  const googleReviewsUrl = configString(
    siteConfig,
    "google_reviews_url",
    "https://www.google.com/maps/place/LaserOps+Malta/@35.9351506,14.0734794,11z/data=!4m12!1m2!2m1!1slaserops+malta!3m8!1s0x130e4ddaeadfe003:0xda30f052e79ffef8!8m2!3d35.9351506!4d14.37835!9m1!1b1!15sCg5sYXNlcm9wcyBtYWx0YVoQIg5sYXNlcm9wcyBtYWx0YZIBGm91dGRvb3JfYWN0aXZpdHlfb3JnYW5pemVymgFEQ2k5RFFVbFJRVU52WkVOb2RIbGpSamx2VDJwc2EyUkZSa3haYm1SYVpVaENTbVZHYkZWV1JscHlWVWRXTlZSSVl4QULgAQD6AQQIQBA6!16s%2Fg%2F11z6lk5clw!5m2!1e4!1e1?entry=ttu&g_ep=EgoyMDI2MDUwNi4wIKXMDSoASAFQAw%3D%3D",
  );

  // Transform CMS shapes into the GallerySection's props shape.
  const instagramItems = instagramPosts.map((post, idx) => ({
    id: `cms-ig-${idx}`,
    imageSrc: post.imagePath,
    caption: post.captionOverride,
    postUrl: post.postUrl,
  }));

  // For reviews, the existing component shape includes a "relativeTime"
  // string (e.g. "3 weeks ago"). The CMS stores an absolute date.
  const reviewItems = googleReviews.map((review, idx) => ({
    id: `cms-gr-${idx}`,
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
