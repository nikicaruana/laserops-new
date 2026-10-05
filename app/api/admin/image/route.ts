/**
 * app/api/admin/image/route.ts
 * --------------------------------------------------------------------
 * Generic admin image upload. Server-signs a Cloudinary upload (the API
 * secret never reaches the client) into the folder for the requested `kind`
 * (gun / accolade / …) and returns the secure URL; the caller stores it in
 * the relevant config column on save. Admin-gated. No-SDK direct-REST pattern.
 */
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_IMAGE_FOLDERS, CONTENT_IMAGE_TAGS } from "@/lib/cloudinary";

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB

export async function POST(request: Request) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return Response.json({ ok: false, error: "Image uploads are not configured." }, { status: 500 });
  }

  // Admin only.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    return Response.json({ ok: false, error: "Admins only." }, { status: 403 });
  }

  // Read the file + kind.
  let file: File | null = null;
  let kind = "";
  try {
    const form = await request.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
    kind = String(form.get("kind") ?? "");
  } catch {
    return Response.json({ ok: false, error: "Invalid upload." }, { status: 400 });
  }

  const folder = ADMIN_IMAGE_FOLDERS[kind];
  if (!folder) {
    return Response.json({ ok: false, error: "Unknown image kind." }, { status: 400 });
  }
  if (!file) {
    return Response.json({ ok: false, error: "No file provided." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return Response.json({ ok: false, error: "File must be an image." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ ok: false, error: "Image is too large (max 6 MB)." }, { status: 400 });
  }

  // Server-signed upload. No fixed public_id – each image is its own asset.
  const timestamp = Math.floor(Date.now() / 1000);
  const contentTag = CONTENT_IMAGE_TAGS[kind];
  const paramsToSign: Record<string, string | number | boolean> = contentTag ? { folder, tags: contentTag, timestamp } : { folder, timestamp };
  const signatureBase = Object.keys(paramsToSign)
    .sort()
    .map((k) => `${k}=${paramsToSign[k]}`)
    .join("&");
  const signature = crypto.createHash("sha1").update(signatureBase + apiSecret).digest("hex");

  const uploadForm = new FormData();
  uploadForm.append("file", file);
  uploadForm.append("api_key", apiKey);
  uploadForm.append("timestamp", String(timestamp));
  uploadForm.append("folder", folder);
  if (contentTag) uploadForm.append("tags", contentTag);
  uploadForm.append("signature", signature);

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: uploadForm,
      signal: AbortSignal.timeout(30_000),
    });
    const data = (await res.json()) as { secure_url?: string; error?: { message?: string } };
    if (!res.ok || !data.secure_url) {
      console.error("[admin/image] Cloudinary upload failed:", data?.error);
      return Response.json({ ok: false, error: "Upload failed. Please try again." }, { status: 502 });
    }
    return Response.json({ ok: true, url: data.secure_url });
  } catch (err) {
    console.error("[admin/image] Cloudinary request error:", err);
    return Response.json({ ok: false, error: "Upload failed. Please try again." }, { status: 502 });
  }
}
