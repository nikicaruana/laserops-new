/**
 * lib/cloudinary.ts
 * --------------------------------------------------------------------
 * Cloudinary gallery image fetcher. Uses the Cloudinary REST API
 * directly (no SDK) so Next.js ISR caching works natively — the same
 * pattern as lib/sheets.ts.
 *
 * Required env vars:
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 *
 * Missing vars → fetchGalleryImages() returns [] (non-alarming empty
 * state, consistent with other fetchers in this project).
 */

export type CloudinaryImage = {
  /** e.g. "gallery/match-2024-01/img001" */
  publicId: string;
  /** Full https://res.cloudinary.com/... URL */
  secureUrl: string;
  width: number;
  height: number;
  /**
   * Top-level folder name extracted from publicId, e.g. "gallery" or a
   * sub-folder like "events". Used for the filter pills.
   * Falls back to "" if there's no slash in the publicId.
   */
  folder: string;
  /** Optional: populated from the image's context metadata (alt / caption). */
  caption?: string;
  /** Tags applied to this image in Cloudinary (e.g. ["featured"]). */
  tags: string[];
};

/** Revalidate every 30 minutes — same as CMS_REVALIDATE_SECONDS. */
const GALLERY_REVALIDATE_SECONDS = 1800;

/**
 * Fetch all images in the Cloudinary account (up to 500). Sorted by
 * `created_at` descending so the newest uploads appear first.
 *
 * Returns [] on any error so the gallery page renders an empty state
 * instead of throwing.
 */
export async function fetchGalleryImages(): Promise<CloudinaryImage[]> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    // Env vars not configured — return empty without logging noise.
    return [];
  }

  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const url = new URL(
    `https://api.cloudinary.com/v1_1/${cloudName}/resources/image`,
  );
  url.searchParams.set("max_results", "500");
  url.searchParams.set("context", "true");
  url.searchParams.set("tags", "true");
  // Newest uploads first so the most recent match photos appear at the top.
  url.searchParams.set("direction", "desc");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Basic ${credentials}`,
      },
      next: { revalidate: GALLERY_REVALIDATE_SECONDS },
    });

    if (!res.ok) {
      console.error(
        `[cloudinary] API error: ${res.status} ${res.statusText}`,
      );
      return [];
    }

    const data = (await res.json()) as { resources?: any[] }; // any: Cloudinary REST response is untyped
    if (!Array.isArray(data.resources)) return [];

    return data.resources.map(parseResource);
  } catch (err) {
    console.error("[cloudinary] fetch failed:", err);
    return [];
  }
}

function parseResource(r: any): CloudinaryImage { // any: Cloudinary REST response is untyped
  const publicId: string = r.public_id ?? "";
  // Derive folder: everything up to (not including) the last slash.
  const slashIdx = publicId.lastIndexOf("/");
  const folder = slashIdx !== -1 ? publicId.slice(0, slashIdx) : "";

  // Caption from context: Cloudinary stores custom metadata under
  // r.context?.custom?.alt or r.context?.custom?.caption.
  const ctx = r.context?.custom ?? {};
  const caption: string | undefined =
    ctx.alt || ctx.caption || undefined;

  return {
    publicId,
    secureUrl: r.secure_url ?? "",
    width: r.width ?? 0,
    height: r.height ?? 0,
    folder,
    caption,
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
  };
}
