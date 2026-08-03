/**
 * app/api/cron/go-live/route.ts
 * --------------------------------------------------------------------
 * Scheduled job: brings confirmed matches live ~30 minutes before their start,
 * generating the 4-digit entry code and emailing it to the admins. Guarded by
 * CRON_SECRET (Vercel Cron sends it as a Bearer token). Runs with the service
 * role, so the secret check is the gate. Admins can still Start a match by hand.
 */
import type { NextRequest } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

function gen4() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return Response.json({ ok: false, error: "Service role not configured." }, { status: 500 });
  }

  // Confirmed games whose start is within the next 30 minutes (or just past).
  const cutoff = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const { data: due, error } = await supabase
    .from("matches")
    .select("id, title, scheduled_at")
    .eq("status", "confirmed")
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", cutoff);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  if (!due || due.length === 0) return Response.json({ ok: true, started: 0 });

  // Admin recipients for the code email.
  const { data: adminRows } = await supabase
    .from("accounts")
    .select("email")
    .eq("is_admin", true)
    .not("email", "is", null);
  const adminEmails = Array.from(
    new Set(((adminRows ?? []) as { email: string | null }[]).map((a) => a.email).filter(Boolean) as string[]),
  );
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  const started: { id: string; code: string; match_code: string | null }[] = [];
  for (const m of due) {
    const code = gen4();
    // Guard the transition with .eq("status","confirmed") so a race (admin
    // started it manually) doesn't double-fire; the DB trigger stamps the id.
    const { data: updated, error: upErr } = await supabase
      .from("matches")
      .update({ status: "live", entry_code: code, went_live_at: new Date().toISOString() })
      .eq("id", m.id)
      .eq("status", "confirmed")
      .select("match_code, title, scheduled_at")
      .maybeSingle();
    if (upErr || !updated) continue;

    started.push({ id: m.id, code, match_code: updated.match_code });

    if (resend && adminEmails.length > 0) {
      const when = updated.scheduled_at
        ? new Date(updated.scheduled_at).toLocaleString("en-GB", {
            timeZone: "Europe/Malta",
            weekday: "short",
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "soon";
      const label = updated.title || updated.match_code || "Match";
      try {
        await resend.emails.send({
          from: "LaserOps <bookings@laseropsmalta.com>",
          to: adminEmails,
          subject: `Match live: ${label} — code ${code}`,
          html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;font-family:Arial,sans-serif;background:#fff;color:#111;">
  <p style="margin:0 0 6px;font-size:13px;color:#666;">A match just went live</p>
  <h2 style="margin:0 0 4px;font-size:20px;">${label}</h2>
  <p style="margin:0 0 16px;font-size:13px;color:#666;">${when}${updated.match_code ? ` · ${updated.match_code}` : ""}</p>
  <p style="margin:0 0 4px;font-size:13px;color:#666;">Join code</p>
  <p style="margin:0;font-size:40px;font-weight:800;letter-spacing:8px;color:#111;">${code}</p>
  <p style="margin:20px 0 0;font-size:12px;color:#888;">Read this out to players so they can join. Also shown in the admin panel.</p>
</body></html>`,
        });
      } catch {
        // Email failure shouldn't stop the match going live.
      }
    }
  }

  return Response.json({ ok: true, started: started.length, matches: started });
}
