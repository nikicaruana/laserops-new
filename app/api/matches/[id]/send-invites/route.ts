/**
 * app/api/matches/[id]/send-invites/route.ts
 * --------------------------------------------------------------------
 * Send (or re-send) the .ics calendar invites for a confirmed game to the
 * business and any registered players, without changing the match status.
 *
 * WHY: private bookings are created already "confirmed" by CreateMatchForm, so
 * they never pass through /confirm (which is what emails the invites). This gives
 * that creation path - and any manual re-send - a way to trigger the same invites.
 * Admin-gated; the actual send is best-effort in sendMatchInvites.
 */
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendMatchInvites } from "@/lib/calendar-invite";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return Response.json({ ok: false, error: "Admins only." }, { status: 403 });

  const { data: match } = await supabase
    .from("matches")
    .select("status, scheduled_at")
    .eq("id", id)
    .maybeSingle();
  if (!match) return Response.json({ ok: false, error: "Match not found." }, { status: 404 });
  if (!match.scheduled_at) return Response.json({ ok: false, error: "This game has no scheduled date/time yet." }, { status: 400 });
  if (!["confirmed", "live"].includes(match.status ?? "")) {
    return Response.json({ ok: false, error: "Calendar invites are only sent once a game is confirmed." }, { status: 400 });
  }

  const res = await sendMatchInvites(id, "REQUEST");
  return Response.json({ ok: res.ok, sent: res.sent, reason: res.reason });
}
