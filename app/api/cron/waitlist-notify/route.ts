/**
 * app/api/cron/waitlist-notify/route.ts
 * --------------------------------------------------------------------
 * Scheduled job: emails players who were auto-promoted off a match waitlist
 * (promoted_at set by the DB trigger) and haven't been told yet. Marks
 * promotion_notified_at so each promotion is emailed once. Guarded by
 * CRON_SECRET; runs with the service role.
 */
import type { NextRequest } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  match_id: string;
  promoted_at: string | null;
  account: { email: string | null } | null;
  match: { title: string | null; match_code: string | null; scheduled_at: string | null } | null;
};

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return Response.json({ ok: false, error: "Service role not configured." }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("match_signups")
    .select("id, match_id, promoted_at, account:accounts(email), match:matches(title, match_code, scheduled_at)")
    .eq("status", "registered")
    .not("promoted_at", "is", null)
    .is("promotion_notified_at", null)
    .limit(100);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as Row[];
  if (rows.length === 0) return Response.json({ ok: true, notified: 0 });

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.laseropsmalta.com";
  let notified = 0;

  for (const r of rows) {
    const email = r.account?.email;
    // Always stamp so we don't retry forever, even if there's no email to send to.
    await supabase.from("match_signups").update({ promotion_notified_at: new Date().toISOString() }).eq("id", r.id);
    if (!email || !resend) continue;

    const label = r.match?.title || r.match?.match_code || "your game";
    const when = r.match?.scheduled_at
      ? new Date(r.match.scheduled_at).toLocaleString("en-GB", {
          timeZone: "Europe/Malta",
          weekday: "short",
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
    try {
      await resend.emails.send({
        from: "LaserOps <bookings@laseropsmalta.com>",
        to: [email],
        subject: `A spot opened up: ${label}`,
        html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;font-family:Arial,sans-serif;background:#fff;color:#111;">
  <p style="margin:0 0 6px;font-size:13px;color:#666;">Good news</p>
  <h2 style="margin:0 0 4px;font-size:20px;">You're off the waitlist for ${label}</h2>
  ${when ? `<p style="margin:0 0 16px;font-size:13px;color:#666;">${when}</p>` : ""}
  <p style="margin:0 0 16px;font-size:14px;">A spot opened up and you're now in. Open the game to confirm your place and pay online.</p>
  <p style="margin:0;"><a href="${appUrl}/player-portal/games/${r.match_id}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;font-size:13px;font-weight:700;">Confirm &amp; pay</a></p>
</body></html>`,
      });
      notified++;
    } catch {
      // Email failure shouldn't block others.
    }
  }

  return Response.json({ ok: true, notified });
}
