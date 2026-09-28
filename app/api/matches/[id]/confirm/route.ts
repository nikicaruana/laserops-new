/**
 * app/api/matches/[id]/confirm/route.ts
 * --------------------------------------------------------------------
 * Admin confirms a match (tentative / awaiting_confirm -> confirmed) and emails
 * every signed-up player that payment is now open (and that paying online lets
 * them book a gun). Runs with the admin's session (is_admin gate); RLS lets
 * the admin update the match and read the signups' emails.
 */
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { emitNotification } from "@/lib/notifications";
import { matchDateLabel, matchTimeRangeLabel } from "@/lib/match-time";
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

  // Only transition from a pre-confirm state (avoids re-emailing on repeat clicks).
  const { data: match, error: upErr } = await supabase
    .from("matches")
    .update({ status: "confirmed" })
    .eq("id", id)
    .in("status", ["tentative", "awaiting_confirm"])
    .select("id, title, scheduled_at, invite_code, is_private, duration_minutes")
    .maybeSingle();

  if (upErr) return Response.json({ ok: false, error: upErr.message }, { status: 500 });
  if (!match) return Response.json({ ok: true, confirmed: false }); // already confirmed / not confirmable

  // Notify every registered signup that payment is open. The notification system
  // owns the email now (game_confirmed_pay -> dispatched by the email cron).
  const { data: signupRows } = await supabase
    .from("match_signups")
    .select("account_id")
    .eq("match_id", id)
    .eq("status", "registered");
  const label = match.title || "Your LaserOps game";
  // Open games: pay online to confirm the place. Private bookings can pay offline
  // on request, so the copy differs.
  const body = match.is_private
    ? "The booking is confirmed. Pay online now (or arrange to pay offline), and book your gun if you pay online."
    : "The game is confirmed. Pay online now to confirm your place and book your gun.";
  const svc = createServiceClient();
  let notified = 0;
  if (svc) {
    const ids = Array.from(
      new Set(((signupRows ?? []) as { account_id: string | null }[]).map((r) => r.account_id).filter(Boolean) as string[]),
    );
    for (const accountId of ids) {
      await emitNotification(svc, accountId, "game_confirmed_pay", {
        title: `${label} is confirmed`,
        body,
        href: `/player-portal/games/${id}`,
        data: { matchDate: matchDateLabel(match.scheduled_at), matchTimeRange: matchTimeRangeLabel(match.scheduled_at, match.duration_minutes) },
      });
      notified++;
    }
  }

  // Calendar invites: players + the business get an .ics for the confirmed game.
  const invites = await sendMatchInvites(id, "REQUEST");

  return Response.json({ ok: true, confirmed: true, notified, invitesSent: invites.sent });
}
