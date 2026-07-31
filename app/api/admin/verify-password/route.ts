/**
 * app/api/admin/verify-password/route.ts
 * --------------------------------------------------------------------
 * Re-authentication check for sensitive admin actions. Confirms the caller
 * (an admin) re-entered their own password. Verifies with a throwaway,
 * cookieless client so the live session is never disturbed. Returns ok:true
 * only when the password matches the signed-in admin's account.
 */
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";

export async function POST(request: Request) {
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
  if (!user.email) {
    return Response.json({ ok: false, error: "No email on your account." }, { status: 400 });
  }

  let password = "";
  try {
    const body = (await request.json()) as { password?: string };
    password = body.password ?? "";
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  if (!password) {
    return Response.json({ ok: false, error: "Enter your password." }, { status: 400 });
  }

  // Throwaway client (no session persistence) so verifying doesn't touch the
  // admin's live session cookies.
  const verifier = createPublicClient();
  const { error } = await verifier.auth.signInWithPassword({ email: user.email, password });
  if (error) {
    return Response.json({ ok: false, error: "Incorrect password." }, { status: 200 });
  }
  return Response.json({ ok: true });
}
