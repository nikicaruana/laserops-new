import { createPublicClient } from "@/lib/supabase/public";
import { getPlayerRecords } from "@/lib/player-history/supabase-engine";

/**
 * GET /api/player-records?ops=<OpsTag>
 * --------------------------------------------------------------------
 * Single-match personal records for one player, used by the Compare page to
 * show each player's one-off game bests side by side. Reads the public
 * match read-model (anon SELECT is granted), so it works for any viewer.
 */
export async function GET(request: Request) {
  const ops = (new URL(request.url).searchParams.get("ops") ?? "").trim();
  if (ops === "") return Response.json({ ok: true, records: [] });

  try {
    const records = await getPlayerRecords(createPublicClient(), ops);
    return Response.json({ ok: true, records });
  } catch {
    return Response.json({ ok: false, records: [] }, { status: 500 });
  }
}
