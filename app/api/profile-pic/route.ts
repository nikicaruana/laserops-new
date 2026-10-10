/**
 * app/api/profile-pic/route.ts
 * --------------------------------------------------------------------
 * Signed avatar upload. The client sends an already-cropped square image;
 * this route:
 *   1. Verifies the caller is signed in (server Supabase client).
 *   2. Finds their own account (RLS scopes this to their row).
 *   3. Uploads the image to Cloudinary via a server-signed REST call –
 *      the API secret never leaves the server. public_id = account id so a
 *      re-upload overwrites the previous avatar (with cache invalidation).
 *   4. Writes the returned URL to accounts.profile_pic_url. The "update
 *      own" RLS policy allows this; profile_pic_url isn't a protected field,
 *      so the guard trigger lets it through.
 *
 * Follows lib/cloudinary.ts's no-SDK, direct-REST pattern.
 */
import crypto from "node:crypto";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PROFILE_PICS_FOLDER } from "@/lib/cloudinary";

const FOLDER = PROFILE_PICS_FOLDER;
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB

export async function POST(request: Request) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return Response.json(
      { ok: false, error: "Image uploads are not configured." },
      { status: 500 },
    );
  }

  // 1. Must be signed in.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  // 2. Their own account (RLS scopes select to their row).
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!account) {
    return Response.json(
      { ok: false, error: "No account linked to your login." },
      { status: 404 },
    );
  }

  // 3. Read the source: either an uploaded file (crop flow) or a sourceUrl of an
  //    existing Cloudinary photo the player is tagged in (Cloudinary fetches it).
  let file: File | null = null;
  let sourceUrl: string | null = null;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = (await request.json()) as { sourceUrl?: string };
      sourceUrl = (body.sourceUrl ?? "").trim();
    } catch {
      return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
    }
    // Only allow copying from our own Cloudinary (no arbitrary remote fetch).
    if (!/^https:\/\/res\.cloudinary\.com\//.test(sourceUrl)) {
      return Response.json({ ok: false, error: "That photo can't be used." }, { status: 400 });
    }
  } else {
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
  }

  // 4. Server-signed Cloudinary upload. Sign the alphabetically-sorted
  //    params (excluding file/api_key), then append the secret.
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = account.id; // one stable avatar per account
  const paramsToSign: Record<string, string | number | boolean> = {
    folder: FOLDER,
    invalidate: true,
    overwrite: true,
    public_id: publicId,
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
  // Cloudinary accepts either a binary file or a remote URL as `file`.
  uploadForm.append("file", file ?? (sourceUrl as string));
  uploadForm.append("api_key", apiKey);
  uploadForm.append("timestamp", String(timestamp));
  uploadForm.append("folder", FOLDER);
  uploadForm.append("public_id", publicId);
  uploadForm.append("overwrite", "true");
  uploadForm.append("invalidate", "true");
  uploadForm.append("signature", signature);

  let secureUrl: string;
  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body: uploadForm, signal: AbortSignal.timeout(30_000) },
    );
    const data = (await res.json()) as { secure_url?: string; error?: { message?: string } };
    if (!res.ok || !data.secure_url) {
      console.error("[profile-pic] Cloudinary upload failed:", data?.error);
      return Response.json(
        { ok: false, error: "Upload failed. Please try again." },
        { status: 502 },
      );
    }
    secureUrl = data.secure_url;
  } catch (err) {
    console.error("[profile-pic] Cloudinary request error:", err);
    return Response.json({ ok: false, error: "Upload failed. Please try again." }, { status: 502 });
  }

  // 5. Persist to the player's account (RLS update-own).
  const { error: updateError } = await supabase
    .from("accounts")
    .update({ profile_pic_url: secureUrl })
    .eq("id", account.id);
  if (updateError) {
    console.error("[profile-pic] account update failed:", updateError);
    return Response.json(
      { ok: false, error: "Saved the image but couldn't update your profile." },
      { status: 500 },
    );
  }

  // The accounts update fires a trigger that syncs the new avatar onto the
  // denormalized stats / leaderboard tables immediately; drop the board caches so
  // the summary and leaderboards reflect it now instead of on the next recompute.
  revalidateTag("leaderboards");
  revalidateTag("sheets");

  return Response.json({ ok: true, url: secureUrl });
}

/**
 * DELETE – reset the avatar to the default (clear profile_pic_url). The
 * Cloudinary asset is left in place (it's keyed by account id and is
 * overwritten on the next upload); only the reference is cleared.
 */
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const { error } = await supabase
    .from("accounts")
    .update({ profile_pic_url: null })
    .eq("auth_user_id", user.id);
  if (error) {
    console.error("[profile-pic] reset failed:", error);
    return Response.json({ ok: false, error: "Couldn't reset your photo." }, { status: 500 });
  }
  revalidateTag("leaderboards");
  revalidateTag("sheets");
  return Response.json({ ok: true });
}
