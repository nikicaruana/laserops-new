/**
 * app/api/ingest/live/route.ts
 * --------------------------------------------------------------------
 * Native live-feed ingest. The venue tablet's background watcher POSTs each
 * (growing) round file here as it changes. Token-authed (Authorization: Bearer
 * <live_ingest_config.token>), NOT a login. Server-side: resolve the target
 * match (the one that's live + has the live feed on, or an explicit code),
 * build the compact snapshot and push it to the live views, and keep the raw
 * round stored for scoring. All writes via the service role.
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveRoster } from "@/lib/ingestion/roster";
import { buildLiveRound, type RoundResolvers } from "@/lib/live-sim/build-round";
import { buildSnapshot } from "@/lib/live-sim/engine";

export async function POST(req: Request) {
  const svc = createServiceClient();
  if (!svc) return NextResponse.json({ error: "Server not configured (service role key missing)." }, { status: 500 });

  // Token auth.
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const { data: cfg } = await svc.from("live_ingest_config").select("token").eq("operator_id", "00000000-0000-0000-0000-000000000001").maybeSingle();
  if (!cfg?.token || !token || token !== cfg.token) return NextResponse.json({ error: "Bad or missing token." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { filename?: string; raw?: string; matchCode?: string };
  const filename = (body.filename ?? "").trim();
  const raw = body.raw ?? "";
  if (!filename || !raw.trim()) return NextResponse.json({ error: "Missing filename or raw." }, { status: 400 });

  // Resolve the target match: explicit code, else the current live + feed-on game.
  let matchId: string | null = null;
  if (body.matchCode) {
    const { data: m } = await svc.from("matches").select("id").eq("match_code", body.matchCode).maybeSingle();
    matchId = (m?.id as string) ?? null;
  } else {
    const { data: m } = await svc.from("matches").select("id").eq("status", "live").eq("live_feed_enabled", true).order("went_live_at", { ascending: false }).limit(1).maybeSingle();
    matchId = (m?.id as string) ?? null;
  }
  if (!matchId) return NextResponse.json({ ok: false, skipped: "no-live-match" });

  // Stable round number: reuse this file's row if seen, else next number.
  const { data: rows } = await svc.from("match_ingest_rounds").select("id, filename, round_no").eq("match_id", matchId);
  const existing = (rows ?? []).find((r) => r.filename === filename);
  const roundNo = existing?.round_no ?? ((rows ?? []).reduce((mx, r) => Math.max(mx, r.round_no ?? 0), 0) + 1);

  // Parse + build the compact snapshot (skip half-written / non-round content).
  const roster = await resolveRoster(svc, matchId);
  const { data: guns } = await svc.from("guns").select("name, image_url");
  const gunImg = new Map(((guns ?? []) as { name: string; image_url: string | null }[]).map((g) => [g.name, g.image_url ?? ""]));
  const res: RoundResolvers = {
    nameOf: (hb) => roster(hb).nickname,
    gunOf: (hb) => { const g = roster(hb).gun || ""; return { name: g, image: g ? gunImg.get(g) ?? "" : "" }; },
  };
  const built = buildLiveRound(raw, roundNo, res);
  if (!built) return NextResponse.json({ ok: false, skipped: "unparseable" });
  const maxEv = built.round.events.reduce((m, e) => Math.max(m, e.t), 0);
  const elapsed = Math.max(Date.now() / 1000 - built.startEpoch, maxEv);
  const snapshot = buildSnapshot(built.round, elapsed);

  await svc.from("match_live_state").upsert({
    match_id: matchId, round_no: roundNo, elapsed_seconds: Math.round(elapsed),
    snapshot, server_ts: new Date().toISOString(),
  });

  // Keep the raw round for scoring (latest content wins; publish reads it later).
  if (existing) await svc.from("match_ingest_rounds").update({ raw_file: raw }).eq("id", existing.id);
  else await svc.from("match_ingest_rounds").insert({ match_id: matchId, filename, raw_file: raw, round_no: roundNo });
  await svc.from("matches").update({ source_file_type: "json" }).eq("id", matchId);

  return NextResponse.json({ ok: true, round_no: roundNo, match_id: matchId });
}
