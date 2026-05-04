import { HomeHero } from "@/components/sections/HomeHero";
import { WeaponsSection } from "@/components/sections/WeaponsSection";
import { GallerySection } from "@/components/sections/GallerySection";
import { SeasonLeadersSection } from "@/components/home/SeasonLeadersSection";
import { Container } from "@/components/ui/Container";
import { fetchInstagramPosts } from "@/lib/cms/instagram-posts";
import { fetchGoogleReviews } from "@/lib/cms/google-reviews";
import { fetchSiteConfig, configString } from "@/lib/cms/site-config";

/**
 * Homepage.
 *
 * Server-side fetches CMS data for the GallerySection, transforms it
 * into the shapes that component expects, and passes it as props.
 * GallerySection itself remains a client component because it needs
 * useEffect for the mobile scroll-to-middle behaviour. The fetch
 * happens here (server) so it doesn't run client-side on every render.
 *
 * If the CMS returns no data (empty tabs, fetch fails), GallerySection
 * falls back to its baked-in sample data — homepage stays meaningful.
 */
export default async function HomePage() {
  // Fetch CMS data in parallel. Each has built-in fallback so this
  // never throws.
  const [instagramPosts, googleReviews, siteConfig] = await Promise.all([
    fetchInstagramPosts(),
    fetchGoogleReviews(),
    fetchSiteConfig(),
  ]);

  // Resolve the Google Reviews link from Site_Config. Editors set
  // `google_reviews_url` in the Site_Config CMS sheet to whatever
  // URL Google's "Write a review" / business profile page is at for
  // LaserOps Malta. If it's not set, we fall back to a generic
  // search URL — better than a broken cid=laserops link, but ideally
  // the editor sets the real URL once and forgets it.
  const googleReviewsUrl = configString(
    siteConfig,
    "google_reviews_url",
    "https://www.google.com/search?q=laserops+malta+reviews",
  );

  // Transform CMS shapes into the GallerySection's props shape.
  // The CMS schema and the legacy hardcoded sample shape diverged a bit
  // (CMS has Caption_Override + Image_Path + Post_URL; component wants
  // imageSrc + caption + postUrl). The mapping is straightforward.
  const instagramItems = instagramPosts.map((post, idx) => ({
    id: `cms-ig-${idx}`,
    imageSrc: post.imagePath,
    caption: post.captionOverride,
    postUrl: post.postUrl,
  }));

  // For reviews, the existing component shape includes a "relativeTime"
  // string (e.g. "3 weeks ago"). The CMS stores an absolute date.
  // We compute a coarse relative label here so editors can paste plain
  // dates without thinking about display formatting.
  const reviewItems = googleReviews.map((review, idx) => ({
    id: `cms-gr-${idx}`,
    rating: review.rating,
    quote: review.reviewText,
    reviewer: review.reviewerName,
    relativeTime: formatRelativeTime(review.date),
    // All review cards link to the same Google reviews destination —
    // Google Reviews don't expose stable per-review URLs anyway. The
    // URL is configured via Site_Config so it can be updated without
    // a code change if Google's link format changes.
    reviewsUrl: googleReviewsUrl,
  }));

  return (
    <>
      <HomeHero />
      <WeaponsSection />
      {/* SeasonLeadersSection is async — fetches CMS + leaderboard data
          server-side. Auto-hides itself if no active season is configured
          or if the homepage_show_season_leaders flag is off in
          Site_Config. Sits between Weapons (marketing hooks) and Gallery
          (social proof) — a "see the action in progress" beat. */}
      <SeasonLeadersSection />
      <GallerySection
        instagramItems={instagramItems}
        reviewItems={reviewItems}
      />

      {/*
        Temporary placeholder for sections still to come:
          - Final CTA band before footer
      */}
      <section className="border-t border-border bg-bg-elevated">
        <Container className="py-32 text-center sm:py-48">
          <span className="eyebrow">Phase 2 — Final stretch</span>
          <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">
            Ready to play?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-text-muted">
            Final CTA band coming next.
          </p>
        </Container>
      </section>
    </>
  );
}

/**
 * Coarse "X ago" formatter. Takes a YYYY-MM-DD string and returns
 * a casual relative time. Doesn't try to be precise — Google Reviews
 * uses similar coarseness ("3 weeks ago", "1 month ago").
 *
 * Returns the raw string if it can't parse — defensive.
 */
function formatRelativeTime(yyyyMmDd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return yyyyMmDd;
  const reviewDate = new Date(yyyyMmDd + "T00:00:00Z");
  if (Number.isNaN(reviewDate.getTime())) return yyyyMmDd;

  const now = new Date();
  const diffMs = now.getTime() - reviewDate.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (days < 0) return yyyyMmDd; // future date — leave raw
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
