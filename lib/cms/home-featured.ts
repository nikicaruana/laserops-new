/**
 * lib/cms/home-featured.ts
 * --------------------------------------------------------------------
 * Admin-selected homepage featured photos (home_featured_photos). Read via the
 * cookieless public client so the homepage stays static / ISR. Returns [] on any
 * failure; GalleryPreview falls back to the Cloudinary `featured` tag when empty.
 * Edited from /admin/homepage.
 */
import { createPublicClient } from "@/lib/supabase/public";

export type FeaturedPhoto = { imageUrl: string; caption: string };

export async function getFeaturedPhotos(): Promise<FeaturedPhoto[]> {
  try {
    const sb = createPublicClient();
    const { data } = await sb
      .from("home_featured_photos")
      .select("image_url, caption, display_order")
      .order("display_order", { ascending: true });
    return (data ?? [])
      .map((r) => ({ imageUrl: (r.image_url ?? "").trim(), caption: (r.caption ?? "").trim() }))
      .filter((p) => p.imageUrl !== "");
  } catch {
    return [];
  }
}
