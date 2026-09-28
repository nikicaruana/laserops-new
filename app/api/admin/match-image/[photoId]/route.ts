/**
 * app/api/admin/match-image/[photoId]/route.ts
 * --------------------------------------------------------------------
 * DELETE a match photo: destroys the Cloudinary asset (signed) and removes the
 * match_photos row (tags cascade). Admin-gated.
 */
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(_request: Request, ctx: { params: Promise<{ photoId: string }> }) {
  const { photoId } = await ctx.params;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return Response.json({ ok: false, error: "Admins only." }, { status: 403 });

  const { data: photo } = await supabase.from("match_photos").select("id, public_id").eq("id", photoId).maybeSingle();
  if (!photo) return Response.json({ ok: false, error: "Photo not found." }, { status: 404 });

  // Destroy the Cloudinary asset (best-effort - proceed with DB delete either way
  // so a Cloudinary hiccup doesn't leave an orphaned DB row the admin can't clear).
  if (cloudName && apiKey && apiSecret) {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const signatureBase = `public_id=${photo.public_id}&timestamp=${timestamp}`;
      const signature = crypto.createHash("sha1").update(signatureBase + apiSecret).digest("hex");
      const form = new FormData();
      form.append("public_id", photo.public_id);
      form.append("api_key", apiKey);
      form.append("timestamp", String(timestamp));
      form.append("signature", signature);
      await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      console.error("[admin/match-image DELETE] Cloudinary destroy error:", err);
    }
  }

  const { error } = await supabase.from("match_photos").delete().eq("id", photo.id);
  if (error) {
    console.error("[admin/match-image DELETE] DB delete failed:", error);
    return Response.json({ ok: false, error: "Could not delete the photo." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
