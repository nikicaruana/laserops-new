import { fetchSheetAsObjects, parseNumericOr } from "@/lib/sheets";
import { CMS_REVALIDATE_SECONDS, CMS_URLS } from "./client";

type InstagramPostRaw = Record<string, string> & {
  Post_URL: string;
  Image_Path: string;
  Caption_Override: string;
  Display_Order: string;
  Status: string;
};

export type InstagramPost = {
  postUrl: string;
  /** Local image path under /public — e.g. "/images/gallery/foo.jpg". */
  imagePath: string;
  /** Optional override caption — empty string if none. */
  captionOverride: string;
  displayOrder: number;
};

/**
 * Fetch published Instagram posts from the CMS, sorted by display order.
 * Hidden posts (Status !== "published") are filtered out.
 *
 * Posts without an Image_Path are dropped — we currently rely on local
 * images saved alongside each post to avoid Instagram's brittle scraping
 * APIs. Editor workflow: post to Instagram, save the image to
 * /public/images/gallery/, paste the path into the sheet.
 */
export async function fetchInstagramPosts(): Promise<InstagramPost[]> {
  const result = await fetchSheetAsObjects<InstagramPostRaw>(
    CMS_URLS.instagramPosts,
    CMS_REVALIDATE_SECONDS,
  );
  if (!result.ok) return [];

  const posts: InstagramPost[] = [];
  for (const row of result.rows) {
    const status = (row.Status ?? "").trim().toLowerCase();
    if (status !== "published") continue;

    const postUrl = (row.Post_URL ?? "").trim();
    if (postUrl === "") continue;

    const imagePath = (row.Image_Path ?? "").trim();
    if (imagePath === "") continue; // image required — skip incomplete rows

    posts.push({
      postUrl,
      imagePath,
      captionOverride: (row.Caption_Override ?? "").trim(),
      displayOrder: parseNumericOr(row.Display_Order, 0),
    });
  }

  return posts.sort((a, b) => a.displayOrder - b.displayOrder);
}
