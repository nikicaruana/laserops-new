/**
 * app/api/matches/[id]/ingest-round/route.ts
 * --------------------------------------------------------------------
 * Ingest match data for scoring. Two shapes, auto-detected from the file:
 *   - ONLINE: one per-round JSON (event stream). Appended; idempotent per
 *     filename. Fed by the in-browser Live auto-ingest watcher on the venue
 *     tablet as each round file appears.
 *   - OFFLINE: one .lwa/CSV aggregate for the WHOLE match (all rounds already
 *     summed). Uploaded by an admin after the game. Since it is the whole match,
 *     it REPLACES any existing ingest rows for the match.
 * Admin session (no 2FA — this is preview data, not the official publish).
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseRound } from "@/lib/ingestion/round-parser";
import { isLwa, lwaMatchPlayers } from "@/lib/ingestion/lwa";
import { createServiceClient } from "@/lib/supabase/service";
import { getInMatchScoreboard } from "@/lib/inmatch/scoreboard";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { filename?: string; raw?: string };
  const filename = (body.filename ?? "").trim();
  const raw = body.raw ?? "";
  if (!raw.trim()) return NextResponse.json({ error: "Empty file." }, { status: 400 });

  // --- OFFLINE: one .lwa/CSV aggregate for the whole match -----------------
  if (isLwa(raw)) {
    let players: ReturnType<typeof lwaMatchPlayers>;
    try {
      players = lwaMatchPlayers(raw);
    } catch {
      return NextResponse.json({ ok: false, skipped: "unparseable" });
    }
    if (players.length === 0) return NextResponse.json({ ok: false, skipped: "no-players" });

    // Whole-match file: replace any prior ingest rows for this match.
    await supabase.from("match_ingest_rounds").delete().eq("match_id", id).eq("mode", "offline");
    const { error: insErr } = await supabase
      .from("match_ingest_rounds")
      .insert({ match_id: id, filename: filename || null, raw_file: raw, mode: "offline" });
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    await supabase.from("matches").update({ source_file_type: "csv", scoring_mode: "offline", live_feed_enabled: false }).eq("id", id);
    return NextResponse.json({ ok: true, mode: "offline", players: players.length });
  }

  // --- ONLINE: one per-round JSON event stream -----------------------------
  // Best-effort parse so we don't ingest a half-written / non-round file.
  try {
    const round = parseRound(raw, { spawnWindowSeconds: 3 });
    if (!round.players || round.players.length === 0) {
      return NextResponse.json({ ok: false, skipped: "no-players" });
    }
  } catch {
    return NextResponse.json({ ok: false, skipped: "unparseable" });
  }

  // Dedupe by filename within the match (each round file has a distinct name).
  if (filename) {
    const { data: existing } = await supabase
      .from("match_ingest_rounds")
      .select("id")
      .eq("match_id", id)
      .eq("filename", filename)
      .maybeSingle();
    if (existing) return NextResponse.json({ ok: true, skipped: "duplicate" });
  }

  // Assign a stable round number (this file is new — duplicates returned above).
  const { data: mx } = await supabase
    .from("match_ingest_rounds")
    .select("round_no")
    .eq("match_id", id)
    .eq("mode", "online")
    .order("round_no", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const roundNo = (mx?.round_no ?? 0) + 1;

  const { error: insErr } = await supabase
    .from("match_ingest_rounds")
    .insert({ match_id: id, filename: filename || null, raw_file: raw, mode: "online", round_no: roundNo });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Touch the match: marks it JSON-sourced AND fires the realtime change that
  // refreshes players' live pages so the new round's scores appear at once.
  await supabase.from("matches").update({ source_file_type: "json" }).eq("id", id);

  // Build + cache this round's in-match scoreboard now (parse once at upload)
  // so player reads between rounds are instant. Best-effort: the read path
  // rebuilds on demand if this fails.
  try {
    const svc = createServiceClient();
    if (svc) {
      const { data: m } = await svc.from("matches").select("title, match_code").eq("id", id).maybeSingle();
      await getInMatchScoreboard(svc, id, { label: m?.title || m?.match_code || "Game", date: null });
    }
  } catch {
    /* non-fatal */
  }

  const { count } = await supabase
    .from("match_ingest_rounds")
    .select("id", { count: "exact", head: true })
    .eq("match_id", id);

  return NextResponse.json({ ok: true, mode: "online", rounds: count ?? null, roundNo });
}
