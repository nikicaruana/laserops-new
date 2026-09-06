/**
 * app/api/matches/[id]/ingest-round/route.ts
 * --------------------------------------------------------------------
 * Auto-ingest one round file for a match. Called by the in-browser Live
 * auto-ingest watcher (File System Access API) on the venue tablet as each
 * per-round JSON appears in the AlphaTag export folder. Admin session (no 2FA —
 * this is preview data, not the official publish). Idempotent per filename so
 * re-reads of the same file don't create duplicate rounds.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseRound } from "@/lib/ingestion/round-parser";

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

  const { error: insErr } = await supabase
    .from("match_ingest_rounds")
    .insert({ match_id: id, filename: filename || null, raw_file: raw });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Note the source type so the match shows as JSON-sourced.
  await supabase.from("matches").update({ source_file_type: "json" }).eq("id", id);

  const { count } = await supabase
    .from("match_ingest_rounds")
    .select("id", { count: "exact", head: true })
    .eq("match_id", id);

  return NextResponse.json({ ok: true, rounds: count ?? null });
}
