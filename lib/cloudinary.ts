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
 * Optional env var:
 *   CLOUDINARY_GALLERY_FOLDER — restrict results to this folder and its
 *   subfolders (e.g. "laseropsmalta.com/Gallery"). Uses asset_folder
 *   matching, which works in Cloudinary's dynamic folder mode where the
 *   folder path is NOT part of the public_id.
 *
 * Missing required vars → fetchGalleryImages() returns [] (non-alarming
 * empty state, consistent with other fetchers in this project).
 */

export type CloudinaryImage = {
  publicId: string;
  /** Full https://res.cloudinary.com/... URL */
  secureUrl: string;
  width: number;
  height: number;
  /**
   * The asset_folder from Cloudinary (dynamic folder mode), e.g.
   * "laseropsmalta.com/Gallery/Open_Game_2026-04-11". Used for filter
   * pills — folderLabel() extracts the last path segment for display.
   */
  folder: string;
  /** Optional: populated from context metadata (alt / caption). */
  caption?: string;
  /** Tags applied to this image in Cloudinary (e.g. ["featured"]). */
  tags: string[];
};

/** Revalidate every 30 minutes — same as CMS_REVALIDATE_SECONDS. */
const GALLERY_REVALIDATE_SECONDS = 1800;

/**
 * Fetch gallery images from Cloudinary. Sorted by created_at descending
 * so newest uploads appear first.
 *
 * When CLOUDINARY_GALLERY_FOLDER is set, only images whose asset_folder
 * matches that path (or a subfolder of it) are returned. This works in
 * Cloudinary's dynamic folder mode where folder info lives in asset_folder,
 * not in the public_id — so the old `prefix` parameter on /resources/image
 * doesn't apply.
 *
 * Returns [] on any error so the gallery page renders an empty state.
 */
export async function fetchGalleryImages(): Promise<CloudinaryImage[]> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return [];
  }

  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const url = new URL(
    `https://api.cloudinary.com/v1_1/${cloudName}/resources/image`,
  );
  url.searchParams.set("max_results", "500");
  url.searchParams.set("context", "true");
  url.searchParams.set("tags", "true");
  // Newest uploads first.
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

    const galleryFolder = process.env.CLOUDINARY_GALLERY_FOLDER;

    const images = data.resources
      .map(parseResource)
      // Filter by asset_folder when configured. Keeps images whose folder
      // exactly matches OR is a subfolder of CLOUDINARY_GALLERY_FOLDER.
      // This is the correct approach for dynamic folder mode — the prefix
      // parameter on /resources/image only matches public_id, which in
      // dynamic folder mode is just the filename, not the folder path.
      .filter((img) => {
        if (!galleryFolder) return true;
        return (
          img.folder === galleryFolder ||
          img.folder.startsWith(galleryFolder + "/")
        );
      });

    return images;
  } catch (err) {
    console.error("[cloudinary] fetch failed:", err);
    return [];
  }
}

/**
 * Fetch images by tag from Cloudinary. Uses the dedicated tags endpoint
 * so only images carrying that tag are returned — much more efficient
 * than fetching everything and filtering client-side.
 *
 * Returns [] on any error or missing credentials.
 */
export async function fetchImagesByTag(tag: string): Promise<CloudinaryImage[]> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) return [];

  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const url = new URL(
    `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/tags/${encodeURIComponent(tag)}`,
  );
  url.searchParams.set("max_results", "20");
  url.searchParams.set("context", "true");
  url.searchParams.set("direction", "desc");

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Basic ${credentials}` },
      next: { revalidate: GALLERY_REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      console.error(`[cloudinary] tags API error: ${res.status} ${res.statusText}`);
      return [];
    }
    const data = (await res.json()) as { resources?: any[] }; // any: Cloudinary REST response is untyped
    if (!Array.isArray(data.resources)) return [];
    return data.resources.map(parseResource);
  } catch (err) {
    console.error("[cloudinary] fetchImagesByTag failed:", err);
    return [];
  }
}

function parseResource(r: any): CloudinaryImage { // any: Cloudinary REST response is untyped
  const publicId: string = r.public_id ?? "";

  // Dynamic folder mode: asset_folder holds the full folder path
  // (e.g. "laseropsmalta.com/Gallery/Open_Game_2026-04-11").
  // Fixed folder mode: fall back to extracting from public_id.
  const folder: string =
    (r.asset_folder as string | undefined) ??
    (() => {
      const slashIdx = publicId.lastIndexOf("/");
      return slashIdx !== -1 ? publicId.slice(0, slashIdx) : "";
    })();

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
