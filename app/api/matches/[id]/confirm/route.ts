/**
 * app/api/matches/[id]/confirm/route.ts
 * --------------------------------------------------------------------
 * Admin confirms a match (tentative / awaiting_confirm -> confirmed) and emails
 * every signed-up player that payment is now open (and that paying online lets
 * them book a gun). Runs with the admin's session (is_admin gate); RLS lets
 * the admin update the match and read the signups' emails.
 */
import type { NextRequest } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    .select("id, title, scheduled_at, invite_code")
    .maybeSingle();

  if (upErr) return Response.json({ ok: false, error: upErr.message }, { status: 500 });
  if (!match) return Response.json({ ok: true, confirmed: false }); // already confirmed / not confirmable

  // Email the registered signups.
  const { data: signupRows } = await supabase
    .from("match_signups")
    .select("account:accounts(email)")
    .eq("match_id", id)
    .eq("status", "registered");
  const emails = Array.from(
    new Set(
      ((signupRows ?? []) as unknown as { account: { email: string | null } | null }[])
        .map((r) => r.account?.email)
        .filter(Boolean) as string[],
    ),
  );

  let emailed = 0;
  if (process.env.RESEND_API_KEY && emails.length > 0) {
    const origin = new URL(req.url).origin;
    const link = match.invite_code ? `${origin}/invite/${match.invite_code}` : `${origin}/player-portal/games`;
    const when = match.scheduled_at
      ? new Date(match.scheduled_at).toLocaleString("en-GB", {
          timeZone: "Europe/Malta",
          weekday: "long",
          day: "2-digit",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "soon";
    const label = match.title || "Your LaserOps game";
    const resend = new Resend(process.env.RESEND_API_KEY);
    try {
      await resend.emails.send({
        from: "LaserOps <bookings@laseropsmalta.com>",
        to: emails,
        subject: `Confirmed: ${label}`,
        html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;font-family:Arial,sans-serif;background:#fff;color:#111;">
  <p style="margin:0 0 6px;font-size:13px;color:#666;">Good news — your game is confirmed</p>
  <h2 style="margin:0 0 4px;font-size:20px;">${label}</h2>
  <p style="margin:0 0 16px;font-size:13px;color:#666;">${when}</p>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.5;">
    We&rsquo;re now accepting payment. You can pay online now or on the day — and if you
    <strong>pay online in advance you can book your gun</strong> ready for the game.
  </p>
  <p style="margin:0 0 24px;">
    <a href="${link}" style="display:inline-block;background:#ffde00;color:#111;font-weight:700;text-decoration:none;padding:12px 20px;font-size:13px;letter-spacing:0.5px;text-transform:uppercase;">Sort my payment</a>
  </p>
  <p style="margin:0;font-size:12px;color:#888;">See you on the field.</p>
</body></html>`,
      });
      emailed = emails.length;
    } catch {
      // Email failure shouldn't block confirmation.
    }
  }

  return Response.json({ ok: true, confirmed: true, emailed });
}
