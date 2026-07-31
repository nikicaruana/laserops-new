/**
 * app/api/admin/gun-image/route.ts
 * --------------------------------------------------------------------
 * Admin-only gun image upload. Server-signs a Cloudinary upload (the API
 * secret never reaches the client) and returns the secure URL; the caller
 * (GunEditor) stores it in guns.image_url on save. Same no-SDK direct-REST
 * pattern as app/api/profile-pic.
 */
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { GUNS_FOLDER } from "@/lib/cloudinary";

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

  // Read the uploaded file.
  let file: File | null = null;
  try {
    const form = await request.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return Response.json({ ok: false, error: "Invalid upload." }, { status: 400 });
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

  // Server-signed upload. No fixed public_id — each gun image is its own asset.
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign: Record<string, string | number | boolean> = {
    folder: GUNS_FOLDER,
    timestamp,
  };
  const signatureBase = Object.keys(paramsToSign)
    .sort()
    .map((k) => `${k}=${paramsToSign[k]}`)
    .join("&");
  const signature = crypto
    .createHash("sha1")
    .update(signatureBase + apiSecret)
    .digest("hex");

  const uploadForm = new FormData();
  uploadForm.append("file", file);
  uploadForm.append("api_key", apiKey);
  uploadForm.append("timestamp", String(timestamp));
  uploadForm.append("folder", GUNS_FOLDER);
  uploadForm.append("signature", signature);

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: uploadForm,
      signal: AbortSignal.timeout(30_000),
    });
    const data = (await res.json()) as { secure_url?: string; error?: { message?: string } };
    if (!res.ok || !data.secure_url) {
      console.error("[gun-image] Cloudinary upload failed:", data?.error);
      return Response.json({ ok: false, error: "Upload failed. Please try again." }, { status: 502 });
    }
    return Response.json({ ok: true, url: data.secure_url });
  } catch (err) {
    console.error("[gun-image] Cloudinary request error:", err);
    return Response.json({ ok: false, error: "Upload failed. Please try again." }, { status: 502 });
  }
}
