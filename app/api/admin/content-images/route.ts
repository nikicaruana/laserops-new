/**
 * app/api/admin/content-images/route.ts
 * --------------------------------------------------------------------
 * Admin content-page images: list the images for a content surface (by its tag)
 * and delete one by public_id. Upload goes through /api/admin/image, which tags
 * the asset for the surface so the matching content page picks it up. Listing
 * uses the Cloudinary admin API (works on the live/staging site; 401s on local
 * dev - uploads still work everywhere). Admin-gated.
 */
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { fetchImagesByTag, CONTENT_IMAGE_TAGS } from "@/lib/cloudinary";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Not signed in." };
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { ok: false as const, status: 403, error: "Admins only." };
  return { ok: true as const };
}

export async function GET(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return Response.json({ ok: false, error: gate.error }, { status: gate.status });
  const kind = new URL(request.url).searchParams.get("kind") ?? "";
  const tag = CONTENT_IMAGE_TAGS[kind];
  if (!tag) return Response.json({ ok: false, error: "Unknown content surface." }, { status: 400 });
  const images = await fetchImagesByTag(tag);
  return Response.json({ ok: true, images: images.map((i) => ({ publicId: i.publicId, url: i.secureUrl })) });
}

export async function DELETE(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return Response.json({ ok: false, error: gate.error }, { status: gate.status });
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return Response.json({ ok: false, error: "Not configured." }, { status: 500 });
  let publicId = "";
  try { publicId = String(((await request.json()) as { publicId?: string }).publicId ?? "").trim(); } catch { /* bad body */ }
  if (!publicId) return Response.json({ ok: false, error: "No image specified." }, { status: 400 });
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto.createHash("sha1").update(`public_id=${publicId}&timestamp=${timestamp}` + apiSecret).digest("hex");
    const form = new FormData();
    form.append("public_id", publicId);
    form.append("api_key", apiKey);
    form.append("timestamp", String(timestamp));
    form.append("signature", signature);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, { method: "POST", body: form, signal: AbortSignal.timeout(20_000) });
    const data = (await res.json()) as { result?: string };
    if (data.result !== "ok" && data.result !== "not found") return Response.json({ ok: false, error: "Delete failed." }, { status: 502 });
  } catch (err) {
    console.error("[admin/content-images DELETE]", err);
    return Response.json({ ok: false, error: "Delete failed." }, { status: 502 });
  }
  return Response.json({ ok: true });
}
