/**
 * lib/cms/home-social.ts
 * --------------------------------------------------------------------
 * Homepage social-proof content (Instagram posts + Google reviews shown in the
 * bottom GallerySection), read from Supabase (home_social_posts / home_reviews).
 * Cookieless public client so the homepage stays static / ISR. Published rows
 * only, ordered by display_order. Never throws – returns [] on any failure, and
 * GallerySection falls back to its own sample data when both are empty.
 *
 * Replaces the old Sheets-backed fetchInstagramPosts / fetchGoogleReviews.
 * Edited from /admin/homepage.
 */
import { createPublicClient } from "@/lib/supabase/public";

export type HomeSocialPost = {
  postUrl: string;
  /** Cloudinary secure_url OR a legacy local /public path. Used as <img src>. */
  imageUrl: string;
  caption: string;
};

export type HomeReview = {
  reviewerName: string;
  /** 1-5. */
  rating: number;
  reviewText: string;
  /** YYYY-MM-DD, or "" if unset. */
  date: string;
};

export async function getHomeSocialPosts(): Promise<HomeSocialPost[]> {
  try {
    const sb = createPublicClient();
    const { data } = await sb
      .from("home_social_posts")
      .select("post_url, image_url, caption, display_order")
      .eq("status", "published")
      .order("display_order", { ascending: true });
    if (!data) return [];
    return data
      .map((r) => ({
        postUrl: (r.post_url ?? "").trim(),
        imageUrl: (r.image_url ?? "").trim(),
        caption: (r.caption ?? "").trim(),
      }))
      // An image is required; a post URL is nice-to-have (card still links out).
      .filter((p) => p.imageUrl !== "");
  } catch {
    return [];
  }
}

export async function getHomeReviews(): Promise<HomeReview[]> {
  try {
    const sb = createPublicClient();
    const { data } = await sb
      .from("home_reviews")
      .select("reviewer_name, rating, review_text, review_date, display_order")
      .eq("status", "published")
      .order("display_order", { ascending: true });
    if (!data) return [];
    return data
      .map((r) => ({
        reviewerName: (r.reviewer_name ?? "").trim(),
        rating: Math.max(1, Math.min(5, Math.round(Number(r.rating) || 5))),
        reviewText: (r.review_text ?? "").trim(),
        date: (r.review_date ?? "") ? String(r.review_date) : "",
      }))
      .filter((r) => r.reviewerName !== "");
  } catch {
    return [];
  }
}
