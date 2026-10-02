/**
 * app/api/photos/overlay/route.ts
 * --------------------------------------------------------------------
 * GET /api/photos/overlay?match=LO-2026-28
 * Returns the signed-in viewer's ops tag + their story overlay data for that
 * match (the same data the match report builds), so the gallery can open the
 * full PhotoStoryComposer without loading the whole report page. Responds with
 * { ops: "", overlayData: null } when signed out or the viewer did not play it.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchMatchReportSupabase } from "@/lib/match-report/supabase-engine";
import { findPlayerInReport } from "@/lib/match-report/engine";
import { buildOverlayData } from "@/lib/story/meta";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("match")?.trim();
  if (!code) return NextResponse.json({ ops: "", overlayData: null });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ops: "", overlayData: null });

  const { data: account } = await supabase
    .from("accounts")
    .select("ops_tag")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const ops = (account?.ops_tag ?? "").trim();
  if (!ops) return NextResponse.json({ ops: "", overlayData: null });

  const result = await fetchMatchReportSupabase(supabase, code);
  if (!result.ok) return NextResponse.json({ ops, overlayData: null });

  const viewerPlayer = findPlayerInReport(result.report, ops);
  const overlayData = viewerPlayer ? buildOverlayData(result.report, viewerPlayer) : null;
  return NextResponse.json({ ops, overlayData });
}
