/**
 * app/api/squad-badge/route.ts  – POST
 * --------------------------------------------------------------------
 * Signed squad-badge upload. The client sends a cropped square image + squad_id.
 * This route verifies the caller is that squad's CAPTAIN, uploads to Cloudinary
 * (server-signed; public_id = squad id so a re-upload overwrites), then writes
 * the URL via the update_squad RPC (which re-checks captain). Mirrors the avatar
 * upload in app/api/profile-pic.
 */
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { SQUAD_BADGES_FOLDER } from "@/lib/cloudinary";

const MAX_BYTES = 6 * 1024 * 1024;

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

  let file: File | null = null;
  let squadId = "";
  try {
    const form = await request.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
    squadId = String(form.get("squad_id") ?? "");
  } catch {
    return Response.json({ ok: false, error: "Invalid upload." }, { status: 400 });
  }
  if (!file) return Response.json({ ok: false, error: "No file provided." }, { status: 400 });
  if (!file.type.startsWith("image/")) return Response.json({ ok: false, error: "File must be an image." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ ok: false, error: "Image is too large (max 6 MB)." }, { status: 400 });
  if (!squadId) return Response.json({ ok: false, error: "Missing squad." }, { status: 400 });

  // Must be the squad's captain (the account's own row is readable under RLS,
  // and the squad row is visible to members).
  const { data: account } = await supabase.from("accounts").select("id").eq("auth_user_id", user.id).maybeSingle();
  const { data: squad } = await supabase.from("squads").select("captain_account_id").eq("id", squadId).maybeSingle();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  const canEdit = Boolean(account && squad && (squad.captain_account_id === account.id || isAdmin === true));
  if (!canEdit) {
    return Response.json({ ok: false, error: "Only the squad captain (or an admin) can change the badge." }, { status: 403 });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign: Record<string, string | number | boolean> = {
    folder: SQUAD_BADGES_FOLDER,
    invalidate: true,
    overwrite: true,
    public_id: squadId,
    timestamp,
  };
  const signatureBase = Object.keys(paramsToSign)
    .sort()
    .map((k) => `${k}=${paramsToSign[k]}`)
    .join("&");
  const signature = crypto.createHash("sha1").update(signatureBase + apiSecret).digest("hex");

  const uploadForm = new FormData();
  uploadForm.append("file", file);
  uploadForm.append("api_key", apiKey);
  uploadForm.append("timestamp", String(timestamp));
  uploadForm.append("folder", SQUAD_BADGES_FOLDER);
  uploadForm.append("public_id", squadId);
  uploadForm.append("overwrite", "true");
  uploadForm.append("invalidate", "true");
  uploadForm.append("signature", signature);

  let secureUrl: string;
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: uploadForm,
      signal: AbortSignal.timeout(30_000),
    });
    const data = (await res.json()) as { secure_url?: string; error?: { message?: string } };
    if (!res.ok || !data.secure_url) {
      console.error("[squad-badge] Cloudinary upload failed:", data?.error);
      return Response.json({ ok: false, error: "Upload failed. Please try again." }, { status: 502 });
    }
    secureUrl = data.secure_url;
  } catch (err) {
    console.error("[squad-badge] Cloudinary request error:", err);
    return Response.json({ ok: false, error: "Upload failed. Please try again." }, { status: 502 });
  }

  // Admins write directly (admin_all RLS); captains go through update_squad.
  const { error: updErr } = isAdmin === true
    ? await supabase.from("squads").update({ badge_url: secureUrl }).eq("id", squadId)
    : await supabase.rpc("update_squad", { p_squad_id: squadId, p_name: null, p_description: null, p_is_searchable: null, p_badge_url: secureUrl });
  if (updErr) {
    console.error("[squad-badge] update_squad failed:", updErr);
    return Response.json({ ok: false, error: "Saved the image but couldn't update the squad." }, { status: 500 });
  }

  return Response.json({ ok: true, url: secureUrl });
}
