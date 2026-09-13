/**
 * app/api/matches/[id]/publish/route.ts
 * --------------------------------------------------------------------
 * Publish Scores (commit step). Verifies the caller is an admin with a 2FA
 * (aal2) session, checks every capture ambiguity is reviewed, computes the
 * per-player aggregates + accolade awards + XP from the ingested rounds, writes
 * them, and stamps the match as scored. Idempotent: re-publishing replaces the
 * match's aggregate + award rows.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseRound } from "@/lib/ingestion/round-parser";
import { unreviewedCount, type RoundResolutions } from "@/lib/ingestion/resolutions";
import { computeMatchCommit } from "@/lib/ingestion/commit";
import { parseXpConfig } from "@/lib/scoring/xp";
import { resolveRoster } from "@/lib/ingestion/roster";
import { recomputeProgression } from "@/lib/ingestion/progression";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Auth: signed-in admin with a 2FA-elevated (aal2) session.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return NextResponse.json({ error: "Two-factor authentication is required to publish scores." }, { status: 403 });

  // Load ingested rounds.
  const { data: rows, error: rErr } = await supabase.from("match_ingest_rounds").select("raw_file, resolutions").eq("match_id", id).order("created_at");
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });
  const rounds = (rows ?? [])
    .filter((r) => r.raw_file)
    .map((r) => ({ raw: r.raw_file as string, resolutions: (r.resolutions ?? {}) as RoundResolutions }));
  if (rounds.length === 0) return NextResponse.json({ error: "No ingested rounds to publish." }, { status: 400 });

  // Gate: every same-second capture ambiguity must be reviewed first.
  let unreviewed = 0;
  for (const rd of rounds) unreviewed += unreviewedCount(parseRound(rd.raw, { spawnWindowSeconds: 3 }), rd.resolutions);
  if (unreviewed > 0) return NextResponse.json({ error: `${unreviewed} unreviewed capture ambiguity${unreviewed === 1 ? "" : "ies"} — resolve them before publishing.` }, { status: 400 });

  // Accolade id/xp map.
  const { data: accs } = await supabase.from("accolade_definitions").select("id, name, xp").eq("scope", "match");
  const { data: xpCfg } = await supabase.from("xp_config").select("key, value");
  const accoladeByKey = new Map((accs ?? []).map((a) => [norm(a.name as string), { id: a.id as string, xp: (a.xp as number) ?? 0 }]));

  // Roster identity + gun + XP-boost: assigned headbands resolve to the player's
  // profile; unassigned ones keep their raw "Head 39" label. Shared with the
  // post-publish edit step so both attribute stats the same way.
  const identity = await resolveRoster(supabase, id);

  const { data: matchFlags } = await supabase.from("matches").select("is_double_xp").eq("id", id).maybeSingle();
  const result = computeMatchCommit(rounds, accoladeByKey, identity, parseXpConfig((xpCfg ?? []) as { key: string; value: number | null }[]), matchFlags?.is_double_xp === true);

  // Write via the service role (RLS-bypassing; grants added in migration).
  const svc = createServiceClient();
  if (!svc) return NextResponse.json({ error: "Server is not configured for writes (service role key missing)." }, { status: 500 });
  const now = new Date().toISOString();
  await svc.from("match_awards").delete().eq("match_id", id);
  await svc.from("match_player_aggregate").delete().eq("match_id", id);

  const { error: aggErr } = await svc.from("match_player_aggregate").insert(result.aggregates.map((a) => ({ ...a, match_id: id })));
  if (aggErr) return NextResponse.json({ error: `Aggregate write failed: ${aggErr.message}` }, { status: 500 });

  if (result.awards.length) {
    const { error: awErr } = await svc.from("match_awards").insert(result.awards.map((a) => ({ ...a, match_id: id, awarded_at: now })));
    if (awErr) return NextResponse.json({ error: `Awards write failed: ${awErr.message}` }, { status: 500 });
  }

  // Stamp the match scored. Ensure played_on is set (needed for chronological
  // XP/level/ELO ordering + player history) — keep any existing date.
  const { data: mRow } = await svc.from("matches").select("played_on, scheduled_at").eq("id", id).maybeSingle();
  const playedOn = (mRow?.played_on as string | null) || ((mRow?.scheduled_at as string | null)?.slice(0, 10)) || now.slice(0, 10);
  const { error: mErr } = await svc.from("matches").update({
    status: "completed",
    winning_team_colour: result.winnerColour,
    net_result_summary: result.netResultSummary,
    round_count: result.roundCount,
    played_on: playedOn,
    xp_distributed_at: now,
  }).eq("id", id);
  if (mErr) return NextResponse.json({ error: `Match stamp failed: ${mErr.message}` }, { status: 500 });

  // Roll the match into careers: chronological XP/level/Elo back-fill across all
  // matches, then rebuild lifetime stats + grant level rewards + clear stale flags.
  try {
    await recomputeProgression(supabase);
  } catch (e) {
    return NextResponse.json({ error: `Scores saved, but the XP/Elo recompute failed: ${e instanceof Error ? e.message : "unknown error"}` }, { status: 500 });
  }
  const { error: rollupErr } = await supabase.rpc("rollup_match_careers");
  if (rollupErr) return NextResponse.json({ error: `Scores saved, but the career rollup failed: ${rollupErr.message}` }, { status: 500 });

  return NextResponse.json({ ok: true, players: result.aggregates.length, awards: result.awards.length, winner: result.winnerColour });
}
