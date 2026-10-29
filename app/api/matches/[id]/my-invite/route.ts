/**
 * app/api/matches/[id]/my-invite/route.ts
 * --------------------------------------------------------------------
 * Send the signed-in player THEIR OWN calendar invite for a confirmed game.
 * Called right after a player signs up to a game that is already confirmed/live,
 * so they still get an .ics even though they joined after the confirm step (when
 * the roster-wide invites went out). Never emails anyone else.
 *
 * Secure by construction: only ever sends to the caller's own account, and only
 * when they are actually a registered signup of a confirmed/live, scheduled game.
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

  const { data: account } = await supabase.from("accounts").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!account) return Response.json({ ok: true, sent: 0 }); // no linked account, nothing to invite

  const { data: match } = await supabase
    .from("matches")
    .select("status, scheduled_at")
    .eq("id", id)
    .maybeSingle();
  // Only confirmed/live, dated games get invites. A game still tentative will send
  // this player an invite later, when it is confirmed (roster-wide).
  if (!match?.scheduled_at || !["confirmed", "live"].includes(match.status ?? "")) {
    return Response.json({ ok: true, sent: 0 });
  }

  // The caller must actually be a registered player of this game.
  const { data: signup } = await supabase
    .from("match_signups")
    .select("status")
    .eq("match_id", id)
    .eq("account_id", account.id)
    .maybeSingle();
  if (signup?.status !== "registered") return Response.json({ ok: true, sent: 0 });

  const res = await sendMatchInvites(id, "REQUEST", { onlyAccountId: account.id, skipAlreadyInvited: true });
  return Response.json({ ok: res.ok, sent: res.sent });
}
