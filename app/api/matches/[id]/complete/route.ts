/**
 * app/api/matches/[id]/complete/route.ts
 * --------------------------------------------------------------------
 * Admin marks a live game completed (the normal end of a game). Ending a game -
 * early, by cancellation, or normally - requires a 2FA-elevated (aal2) session,
 * so this mirrors the cancel / end-early gate. Admin-gated; the update runs with
 * the caller's session (admin_all RLS). Returns { ok }.
 */
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return Response.json({ ok: false, error: "Admins only." }, { status: 403 });
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return Response.json({ ok: false, error: "Two-factor authentication is required to complete a game." }, { status: 403 });

  const { data: match } = await supabase.from("matches").select("status, scheduled_at").eq("id", id).maybeSingle();
  if (!match) return Response.json({ ok: false, error: "Game not found." }, { status: 404 });
  if (match.status !== "live") return Response.json({ ok: false, error: "Only a live game can be completed." }, { status: 400 });

  const playedOn = (match.scheduled_at ?? new Date().toISOString()).slice(0, 10);
  const { error } = await supabase.from("matches").update({ status: "completed", played_on: playedOn }).eq("id", id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
