/**
 * app/admin/homepage/page.tsx
 * --------------------------------------------------------------------
 * Homepage CMS, all backed by Supabase (off Google Sheets):
 *   - Hero            (home_config)          -> HomeHeroEditor
 *   - Featured photos (home_featured_photos) -> FeaturedPhotosManager
 *   - Social posts    (home_social_posts)    -> SocialPostsManager
 *   - Google reviews  (home_reviews)         -> ReviewsManager
 * Lists are read through the admin (cookie) client so hidden rows show in the
 * editor. Admin gating is handled by the /admin layout.
 */
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getHomeHeroConfig } from "@/lib/cms/home-config";
import { HomeHeroEditor } from "@/components/admin/HomeHeroEditor";
import { FeaturedPhotosManager, type FeaturedPhotoRow } from "@/components/admin/FeaturedPhotosManager";
import { SocialPostsManager, type SocialPostRow } from "@/components/admin/SocialPostsManager";
import { ReviewsManager, type ReviewRow } from "@/components/admin/ReviewsManager";

export const metadata: Metadata = { title: "Homepage" };

export default async function HomepageAdminPage() {
  const supabase = await createClient();
  const [hero, { data: featured }, { data: posts }, { data: reviews }] = await Promise.all([
    getHomeHeroConfig(),
    supabase
      .from("home_featured_photos")
      .select("id, image_url, caption, display_order")
      .order("display_order", { ascending: true }),
    supabase
      .from("home_social_posts")
      .select("id, post_url, image_url, caption, display_order, status")
      .order("display_order", { ascending: true }),
    supabase
      .from("home_reviews")
      .select("id, reviewer_name, rating, review_text, review_date, display_order, status")
      .order("display_order", { ascending: true }),
  ]);

  const featuredRows: FeaturedPhotoRow[] = (featured ?? []).map((p) => ({
    id: p.id as string,
    imageUrl: (p.image_url as string) ?? "",
    caption: (p.caption as string) ?? "",
    displayOrder: Number(p.display_order) || 0,
  }));

  const postRows: SocialPostRow[] = (posts ?? []).map((p) => ({
    id: p.id as string,
    postUrl: (p.post_url as string) ?? "",
    imageUrl: (p.image_url as string) ?? "",
    caption: (p.caption as string) ?? "",
    displayOrder: Number(p.display_order) || 0,
    status: (p.status as SocialPostRow["status"]) ?? "published",
  }));

  const reviewRows: ReviewRow[] = (reviews ?? []).map((r) => ({
    id: r.id as string,
    reviewerName: (r.reviewer_name as string) ?? "",
    rating: Number(r.rating) || 5,
    reviewText: (r.review_text as string) ?? "",
    date: r.review_date ? String(r.review_date) : "",
    displayOrder: Number(r.display_order) || 0,
    status: (r.status as ReviewRow["status"]) ?? "published",
  }));

  return (
    <div>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Homepage</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          Edit the public homepage: the hero section, the featured photo strip, the social posts, and the Google reviews.
          Everything is stored in Supabase and shows on the live site within about a minute.
        </p>
      </header>

      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-text-subtle">Hero section</h2>
      <HomeHeroEditor initial={hero} />

      <h2 className="mb-3 mt-10 text-xs font-bold uppercase tracking-[0.16em] text-text-subtle">Featured photos</h2>
      <FeaturedPhotosManager initial={featuredRows} />

      <h2 className="mb-3 mt-10 text-xs font-bold uppercase tracking-[0.16em] text-text-subtle">
        Social proof (bottom of the homepage)
      </h2>
      <SocialPostsManager initial={postRows} />
      <ReviewsManager initial={reviewRows} />
    </div>
  );
}
