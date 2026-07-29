/**
 * app/api/profile/password/route.ts  — POST
 * --------------------------------------------------------------------
 * Changes (or first-sets) the signed-in user's password.
 *   - If they already have a password (current_user_has_password), the
 *     current password is REQUIRED and verified before the change.
 *   - If they don't (Google / magic-link only), they can set one directly
 *     from their authenticated session.
 * The has-password check is done server-side so the client can't skip the
 * current-password requirement.
 */
import { createClient } from "@/lib/supabase/server";

const MIN_PASSWORD = 8;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  let body: { currentPassword?: unknown; newPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const newPassword = body.newPassword;
  if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD) {
    return Response.json(
      { ok: false, error: `New password must be at least ${MIN_PASSWORD} characters.` },
      { status: 400 },
    );
  }

  // Authoritative: does this user already have a password?
  const { data: hasPassword, error: rpcErr } = await supabase.rpc("current_user_has_password");
  if (rpcErr) {
    console.error("[api/profile/password] has-password check failed:", rpcErr);
    return Response.json({ ok: false, error: "Couldn't verify your account." }, { status: 500 });
  }

  if (hasPassword) {
    const current = body.currentPassword;
    if (typeof current !== "string" || current.length === 0) {
      return Response.json(
        { ok: false, field: "currentPassword", error: "Enter your current password." },
        { status: 400 },
      );
    }
    // Verify by re-authenticating (refreshes the session; same user).
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    });
    if (verifyErr) {
      return Response.json(
        { ok: false, field: "currentPassword", error: "Current password is incorrect." },
        { status: 400 },
      );
    }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
