/**
 * app/api/matches/[id]/recompute/route.ts
 * --------------------------------------------------------------------
 * Recompute XP / level / Elo from the triggered match onward (everything before
 * it is unchanged) and rebuild the lifetime read-models, then clear the "results
 * out of date" flag. Admin + 2FA.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recomputeProgression } from "@/lib/ingestion/progression";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return NextResponse.json({ error: "Two-factor authentication is required to recompute results." }, { status: 403 });

  let stats;
  try {
    stats = await recomputeProgression(supabase, id);
  } catch (e) {
    return NextResponse.json({ error: `Recompute failed: ${e instanceof Error ? e.message : "unknown error"}` }, { status: 500 });
  }
  // Run the full rollup as the SERVICE role: the authenticated role's short
  // statement_timeout cancels this combined recompute ("canceling statement due
  // to statement timeout"). rollup_match_careers already permits service_role.
  const svc = createServiceClient();
  if (!svc) return NextResponse.json({ error: "Server is not configured for writes (service role key missing)." }, { status: 500 });
  const { error: rollupErr } = await svc.rpc("rollup_match_careers");
  if (rollupErr) return NextResponse.json({ error: `Recompute ran, but the rollup failed: ${rollupErr.message}` }, { status: 500 });

  return NextResponse.json({ ok: true, matches: stats.matches, players: stats.rows });
}
