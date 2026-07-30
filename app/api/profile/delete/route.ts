/**
 * app/api/profile/delete/route.ts  — POST
 * --------------------------------------------------------------------
 * Irreversible self-service account deletion. Runs delete_my_account()
 * (unlinks match rows, hard-deletes the account PII + derived stats, and
 * deletes the auth user), then clears the session cookies. The client
 * redirects to the home page afterwards.
 */
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const { data: reclaimCode, error } = await supabase.rpc("delete_my_account");
  if (error) {
    console.error("[api/profile/delete] failed:", error);
    return Response.json({ ok: false, error: "Couldn't delete your account. Please try again." }, { status: 500 });
  }

  // Session is already invalid (auth user gone) — clear the cookies too.
  try {
    await supabase.auth.signOut();
  } catch {
    // ignore — the user no longer exists server-side
  }

  return Response.json({ ok: true, reclaimCode: (reclaimCode as string | null) ?? null });
}
