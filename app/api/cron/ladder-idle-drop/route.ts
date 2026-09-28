/**
 * app/api/cron/ladder-idle-drop/route.ts
 * --------------------------------------------------------------------
 * Scheduled job: drops ladder squads that have been idle beyond their ladder's
 * max_idle_days by one place. All the logic lives in the drop_idle_ladder_squads
 * RPC (a single re-rank per ladder; dropped squads get their idle clock reset so
 * they don't drop again until a full period passes). Guarded by CRON_SECRET and
 * run with the service role. Safe to run frequently – it only writes when a squad
 * actually crosses the idle threshold.
 */
import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return Response.json({ ok: false, error: "Service role not configured." }, { status: 500 });
  }

  const { data, error } = await supabase.rpc("drop_idle_ladder_squads");
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  return Response.json({ ok: true, dropped: data ?? 0 });
}
