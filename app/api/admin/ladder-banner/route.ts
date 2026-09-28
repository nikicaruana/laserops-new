/**
 * app/api/admin/ladder-banner/route.ts  – POST
 * --------------------------------------------------------------------
 * Admin-only ladder banner upload. Uploads to Cloudinary (public_id = ladder id)
 * and writes ladders.image_url (admin_all RLS). The base image is stored full;
 * responsive per-device crops are applied at render via ladderBannerUrl().
 */
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { LADDER_BANNERS_FOLDER } from "@/lib/cloudinary";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return Response.json({ ok: false, error: "Image uploads are not configured." }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) return Response.json({ ok: false, error: "Admins only." }, { status: 403 });

  let file: File | null = null;
  let ladderId = "";
  try {
    const form = await request.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
    ladderId = String(form.get("ladder_id") ?? "");
  } catch {
    return Response.json({ ok: false, error: "Invalid upload." }, { status: 400 });
  }
  if (!file) return Response.json({ ok: false, error: "No file provided." }, { status: 400 });
  if (!file.type.startsWith("image/")) return Response.json({ ok: false, error: "File must be an image." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ ok: false, error: "Image is too large (max 10 MB)." }, { status: 400 });
  if (!ladderId) return Response.json({ ok: false, error: "Missing ladder." }, { status: 400 });

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign: Record<string, string | number | boolean> = {
    folder: LADDER_BANNERS_FOLDER,
    invalidate: true,
    overwrite: true,
    public_id: ladderId,
    timestamp,
  };
  const signature = crypto
    .createHash("sha1")
    .update(Object.keys(paramsToSign).sort().map((k) => `${k}=${paramsToSign[k]}`).join("&") + apiSecret)
    .digest("hex");

  const uploadForm = new FormData();
  uploadForm.append("file", file);
  uploadForm.append("api_key", apiKey);
  uploadForm.append("timestamp", String(timestamp));
  uploadForm.append("folder", LADDER_BANNERS_FOLDER);
  uploadForm.append("public_id", ladderId);
  uploadForm.append("overwrite", "true");
  uploadForm.append("invalidate", "true");
  uploadForm.append("signature", signature);

  let secureUrl: string;
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: uploadForm, signal: AbortSignal.timeout(30_000) });
    const data = (await res.json()) as { secure_url?: string; error?: { message?: string } };
    if (!res.ok || !data.secure_url) {
      console.error("[ladder-banner] Cloudinary upload failed:", data?.error);
      return Response.json({ ok: false, error: "Upload failed. Please try again." }, { status: 502 });
    }
    secureUrl = data.secure_url;
  } catch (err) {
    console.error("[ladder-banner] Cloudinary request error:", err);
    return Response.json({ ok: false, error: "Upload failed. Please try again." }, { status: 502 });
  }

  const { error: updErr } = await supabase.from("ladders").update({ image_url: secureUrl }).eq("id", ladderId);
  if (updErr) return Response.json({ ok: false, error: "Saved the image but couldn't update the ladder." }, { status: 500 });

  return Response.json({ ok: true, url: secureUrl });
}
