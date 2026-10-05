import type { Metadata } from "next";
import { CONTENT_IMAGE_SURFACES } from "@/lib/cloudinary";
import { ContentImagesManager } from "@/components/admin/ContentImagesManager";

export const metadata: Metadata = { title: "Content images" };

export default function ContentImagesPage() {
  const surfaces = CONTENT_IMAGE_SURFACES.map((s) => ({ kind: s.kind, label: s.label }));
  return (
    <div>
      <h1 className="mb-2 text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Content images</h1>
      <p className="mb-6 text-sm text-text-muted">
        Upload photos for the public content pages. Each goes into its own Cloudinary folder and is tagged so the matching
        page picks it up automatically. Listing &amp; deleting existing images works on the live/staging site; local dev can
        only upload.
      </p>
      <ContentImagesManager surfaces={surfaces} />
    </div>
  );
}
