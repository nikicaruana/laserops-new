/**
 * app/api/admin/match-image/route.ts
 * --------------------------------------------------------------------
 * Admin upload of a photo INTO a match. Server-signs a Cloudinary upload into
 * the match's gallery subfolder AND tags the asset with the match_code (so it
 * shows in the public gallery's per-event filter automatically), then records
 * the link in `match_photos`. Caption is stored in the DB, not Cloudinary.
 * Admin-gated. No-SDK direct-REST pattern (mirrors app/api/admin/image).
 */
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB (match photos are larger than badges)

const GALLERY_ROOT = process.env.CLOUDINARY_GALLERY_FOLDER || "laseropsmalta.com/Gallery";

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
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return Response.json({ ok: false, error: "Admins only." }, { status: 403 });

  // Parse the file + match + caption.
  let file: File | null = null;
  let matchId = "";
  let caption = "";
  try {
    const form = await request.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
    matchId = String(form.get("matchId") ?? "").trim();
    caption = String(form.get("caption") ?? "").trim();
  } catch {
    return Response.json({ ok: false, error: "Invalid upload." }, { status: 400 });
  }

  if (!file) return Response.json({ ok: false, error: "No file provided." }, { status: 400 });
  if (!file.type.startsWith("image/")) return Response.json({ ok: false, error: "File must be an image." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ ok: false, error: "Image is too large (max 12 MB)." }, { status: 400 });
  if (!matchId) return Response.json({ ok: false, error: "No match specified." }, { status: 400 });

  // Resolve the match so we can build the folder + tag and validate it exists.
  const { data: match } = await supabase.from("matches").select("id, match_code").eq("id", matchId).maybeSingle();
  if (!match) return Response.json({ ok: false, error: "Match not found." }, { status: 404 });
  const matchCode = (match.match_code as string | null) || match.id;

  const folder = `${GALLERY_ROOT}/${matchCode}`;
  const tags = matchCode; // Cloudinary tag = match code -> per-match tag fetch + gallery grouping.

  // Server-signed upload. Signed params (sorted): folder, tags, timestamp.
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign: Record<string, string | number> = { folder, tags, timestamp };
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
  uploadForm.append("tags", tags);
  uploadForm.append("signature", signature);

  let uploaded: { secure_url?: string; public_id?: string; width?: number; height?: number; error?: { message?: string } };
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: uploadForm,
      signal: AbortSignal.timeout(45_000),
    });
    uploaded = await res.json();
    if (!res.ok || !uploaded.secure_url || !uploaded.public_id) {
      console.error("[admin/match-image] Cloudinary upload failed:", uploaded?.error);
      return Response.json({ ok: false, error: "Upload failed. Please try again." }, { status: 502 });
    }
  } catch (err) {
    console.error("[admin/match-image] Cloudinary request error:", err);
    return Response.json({ ok: false, error: "Upload failed. Please try again." }, { status: 502 });
  }

  // Who uploaded (for the record).
  const { data: account } = await supabase.from("accounts").select("id").eq("auth_user_id", user.id).maybeSingle();

  const { data: photo, error: insertErr } = await supabase
    .from("match_photos")
    .insert({
      match_id: match.id,
      public_id: uploaded.public_id,
      secure_url: uploaded.secure_url,
      width: uploaded.width ?? null,
      height: uploaded.height ?? null,
      caption: caption || null,
      uploaded_by: account?.id ?? null,
    })
    .select("id, secure_url, width, height, caption")
    .single();

  if (insertErr || !photo) {
    console.error("[admin/match-image] DB insert failed:", insertErr);
    return Response.json(
      { ok: false, error: `Uploaded, but saving the record failed: ${insertErr?.message ?? "unknown error"}` },
      { status: 500 },
    );
  }

  // Return a normalized shape matching the client (url, not secure_url).
  return Response.json({
    ok: true,
    photo: { id: photo.id, url: photo.secure_url, caption: photo.caption, width: photo.width, height: photo.height, taggedOps: [] },
  });
}

// Bulk delete: remove EVERY photo in a match (Cloudinary assets + match_photos
// rows). Body: { matchId }. Admin-gated. Cloudinary destroys run in parallel.
export async function DELETE(request: Request) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return Response.json({ ok: false, error: "Admins only." }, { status: 403 });

  let matchId = "";
  try { matchId = String(((await request.json()) as { matchId?: string }).matchId ?? "").trim(); } catch { /* bad body */ }
  if (!matchId) return Response.json({ ok: false, error: "No match specified." }, { status: 400 });

  const { data: photos } = await supabase.from("match_photos").select("id, public_id").eq("match_id", matchId);
  const rows = (photos ?? []) as { id: string; public_id: string }[];
  if (rows.length === 0) return Response.json({ ok: true, deleted: 0 });

  if (cloudName && apiKey && apiSecret) {
    await Promise.allSettled(rows.map(async (p) => {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = crypto.createHash("sha1").update(`public_id=${p.public_id}&timestamp=${timestamp}` + apiSecret).digest("hex");
      const form = new FormData();
      form.append("public_id", p.public_id);
      form.append("api_key", apiKey);
      form.append("timestamp", String(timestamp));
      form.append("signature", signature);
      return fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, { method: "POST", body: form, signal: AbortSignal.timeout(20_000) });
    }));
  }

  const { error } = await supabase.from("match_photos").delete().eq("match_id", matchId);
  if (error) { console.error("[admin/match-image DELETE all] DB delete failed:", error); return Response.json({ ok: false, error: "Could not delete the photos." }, { status: 500 }); }
  return Response.json({ ok: true, deleted: rows.length });
}
