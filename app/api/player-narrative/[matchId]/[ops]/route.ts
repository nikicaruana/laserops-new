/**
 * app/api/player-narrative/[matchId]/[ops]/route.ts
 * --------------------------------------------------------------------
 * Returns the AI match write-up for a player. matchId === "PREVIEW" uses the
 * sample report (admins only). Real matches generate on demand for signed-in
 * users for now; once ingestion lands, real narratives should be generated once
 * at commit and stored, then served from the DB (public read) instead of here.
 */
import { createClient } from "@/lib/supabase/server";
import { findPlayerInReport, type MatchReport } from "@/lib/match-report/engine";
import { buildNarrativeInput, previewRounds } from "@/lib/narrative/input";
import { generatePlayerNarrative } from "@/lib/narrative/generate";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ matchId: string; ops: string }> }) {
  const { matchId, ops } = await ctx.params;
  const decodedMatch = decodeURIComponent(matchId);
  const decodedOps = decodeURIComponent(ops);

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ ok: false, error: "AI write-ups are not configured (missing ANTHROPIC_API_KEY)." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Sign in required." }, { status: 401 });

  let report: MatchReport | null = null;
  if (decodedMatch === "PREVIEW") {
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) return Response.json({ ok: false, error: "Admins only." }, { status: 403 });
    const { buildPreviewReportFromDb } = await import("@/lib/match-report/preview-report");
    report = await buildPreviewReportFromDb();
  } else {
    const { fetchMatchReportSupabase } = await import("@/lib/match-report/supabase-engine");
    const result = await fetchMatchReportSupabase(supabase, decodedMatch);
    if (result.ok) report = result.report;
  }

  if (!report) return Response.json({ ok: false, error: "Match not found." }, { status: 404 });
  const player = findPlayerInReport(report, decodedOps);
  if (!player) return Response.json({ ok: false, error: "Player not found." }, { status: 404 });

  try {
    // Real round data arrives with ingestion; the preview supplies sample rounds.
    const rounds = decodedMatch === "PREVIEW" ? previewRounds(player) : [];
    const text = await generatePlayerNarrative(buildNarrativeInput(report, player, rounds));
    return Response.json({ ok: true, text });
  } catch (err) {
    console.error("[player-narrative] generation failed:", err);
    return Response.json({ ok: false, error: "Could not generate the write-up." }, { status: 502 });
  }
}
