/**
 * app/api/profile/reclaim/route.ts  – POST
 * --------------------------------------------------------------------
 * Re-links the signed-in (returning) player to a retired stats bundle
 * using its reclaim key. reclaim_account() deletes the empty auto-created
 * account and adopts the dormant one, restoring the old gamertag + stats.
 */
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return Response.json({ ok: false, error: "Enter your reclaim key." }, { status: 400 });
  }

  const { error } = await supabase.rpc("reclaim_account", { p_code: code });
  if (error) {
    // The function raises a friendly message for an invalid/used key.
    return Response.json({ ok: false, error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
