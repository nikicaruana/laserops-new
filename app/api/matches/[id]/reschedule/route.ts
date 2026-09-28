/**
 * app/api/matches/[id]/reschedule/route.ts
 * --------------------------------------------------------------------
 * Admin moves a planned game to a new date/time. Calls reschedule_match (moves
 * it + notifies signed-up players in-app), and if the game is already confirmed,
 * bumps the calendar SEQUENCE and re-sends updated .ics invites so everyone's
 * calendar event moves too.
 */
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendMatchInvites } from "@/lib/calendar-invite";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return Response.json({ ok: false, error: "Admins only." }, { status: 403 });

  let newScheduledAt: string | undefined;
  try {
    ({ newScheduledAt } = (await req.json()) as { newScheduledAt?: string });
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  if (!newScheduledAt) return Response.json({ ok: false, error: "Pick a new date and time." }, { status: 400 });

  const { error } = await supabase.rpc("reschedule_match", { p_match_id: id, p_new_scheduled_at: newScheduledAt });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 400 });

  // Confirmed games already sent invites; send an update so calendars move.
  let invitesSent = 0;
  const { data: m } = await supabase.from("matches").select("status, calendar_sequence").eq("id", id).maybeSingle();
  if (m?.status === "confirmed") {
    const svc = createServiceClient();
    if (svc) await svc.from("matches").update({ calendar_sequence: ((m.calendar_sequence as number) ?? 0) + 1 }).eq("id", id);
    const res = await sendMatchInvites(id, "REQUEST");
    invitesSent = res.sent;
  }

  return Response.json({ ok: true, invitesSent });
}
