/**
 * app/api/matches/[id]/recompute/route.ts
 * --------------------------------------------------------------------
 * Recompute XP / level / Elo across all scored matches and rebuild the lifetime
 * read-models, then clear the "results out of date" flag. Admin + 2FA. Recompute
 * is global (Elo is sequential + cross-match), so the [id] is only the match the
 * admin triggered it from.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recomputeProgression } from "@/lib/ingestion/progression";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return NextResponse.json({ error: "Two-factor authentication is required to recompute results." }, { status: 403 });

  let stats;
  try {
    stats = await recomputeProgression(supabase);
  } catch (e) {
    return NextResponse.json({ error: `Recompute failed: ${e instanceof Error ? e.message : "unknown error"}` }, { status: 500 });
  }
  const { error: rollupErr } = await supabase.rpc("rollup_match_careers");
  if (rollupErr) return NextResponse.json({ error: `Recompute ran, but the rollup failed: ${rollupErr.message}` }, { status: 500 });

  return NextResponse.json({ ok: true, matches: stats.matches, players: stats.rows });
}
