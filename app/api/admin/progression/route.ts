/**
 * app/api/admin/progression/route.ts
 * --------------------------------------------------------------------
 * Publish a new XP formula + level map and recompute the WHOLE playerbase.
 * Admin + 2FA. Saves xp_config + rank_levels (service role), then replays every
 * scored match's XP/level/Elo from the new config and rebuilds the read-models.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recomputeProgression } from "@/lib/ingestion/progression";

const OP = "00000000-0000-0000-0000-000000000001";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return NextResponse.json({ error: "Two-factor authentication is required to publish XP changes." }, { status: 403 });

  const body = (await req.json().catch(() => null)) as
    | { config?: Record<string, number>; levels?: { level: number; rank_name?: string | null; score_threshold: number }[] }
    | null;
  if (!body?.config || !Array.isArray(body.levels) || body.levels.length === 0)
    return NextResponse.json({ error: "Bad request: config and levels required." }, { status: 400 });

  const svc = createServiceClient();
  if (!svc) return NextResponse.json({ error: "Service role unavailable." }, { status: 500 });

  const { error: cErr } = await svc.from("xp_config").upsert(
    Object.entries(body.config).map(([key, value]) => ({ operator_id: OP, key, value })),
    { onConflict: "operator_id,key" },
  );
  if (cErr) return NextResponse.json({ error: `Config save failed: ${cErr.message}` }, { status: 500 });

  const { error: lErr } = await svc.from("rank_levels").upsert(
    body.levels.map((l) => ({ operator_id: OP, level: l.level, rank_name: l.rank_name ?? null, score_threshold: l.score_threshold })),
    { onConflict: "operator_id,level" },
  );
  if (lErr) return NextResponse.json({ error: `Level map save failed: ${lErr.message}` }, { status: 500 });

  let stats;
  try {
    stats = await recomputeProgression(supabase);
  } catch (e) {
    return NextResponse.json({ error: `Saved, but recompute failed: ${e instanceof Error ? e.message : "unknown"}` }, { status: 500 });
  }
  const { error: rollupErr } = await supabase.rpc("rollup_match_careers");
  if (rollupErr) return NextResponse.json({ error: `Saved & recomputed, but the rollup failed: ${rollupErr.message}` }, { status: 500 });

  return NextResponse.json({ ok: true, matches: stats.matches, players: stats.rows });
}
