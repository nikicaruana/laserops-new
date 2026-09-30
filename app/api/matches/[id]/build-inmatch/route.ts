/**
 * app/api/matches/[id]/build-inmatch/route.ts
 * --------------------------------------------------------------------
 * Build + cache the in-match round scoreboards for a match right after an admin
 * uploads round JSON, so the player-facing in-match view is populated the moment
 * the break starts (the read path never has to parse). Also touches the match
 * row so players' live pages refresh in realtime. Admin only.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getInMatchScoreboard } from "@/lib/inmatch/scoreboard";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const svc = createServiceClient();
  if (!svc) return NextResponse.json({ error: "No service client." }, { status: 500 });

  const { data: m } = await svc.from("matches").select("title, match_code").eq("id", id).maybeSingle();
  const sb = await getInMatchScoreboard(svc, id, { label: m?.title || m?.match_code || "Game", date: null });
  // Touch the match so players' live pages refresh to show the new round.
  await svc.from("matches").update({ source_file_type: "json" }).eq("id", id);

  return NextResponse.json({ ok: true, rounds: sb.rounds.length });
}
