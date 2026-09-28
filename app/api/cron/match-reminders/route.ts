/**
 * app/api/cron/match-reminders/route.ts
 * --------------------------------------------------------------------
 * Scheduled job: sends the match reminder to registered players once a confirmed
 * match falls within the next 24 hours. Each match fires exactly once, guarded by
 * matches.reminder_sent_at (claimed before emitting). Emits the match_reminder
 * notification with the per-match tokens (date, time, signup + WhatsApp share
 * links); the email goes out via the dispatch cron using the admin template.
 * Guarded by CRON_SECRET, service role.
 */
import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { emitNotification } from "@/lib/notifications";
import { brand } from "@/lib/brand";
import { matchTimeRangeLabel } from "@/lib/match-time";

export const dynamic = "force-dynamic";

const BASE = (process.env.NEXT_PUBLIC_SITE_URL || brand.siteUrl).replace(/\/$/, "");

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createServiceClient();
  if (!supabase) return Response.json({ ok: false, error: "Service role not configured." }, { status: 500 });

  const now = new Date();
  const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const { data: due, error } = await supabase
    .from("matches")
    .select("id, title, scheduled_at, invite_code, duration_minutes")
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .not("scheduled_at", "is", null)
    .gt("scheduled_at", now.toISOString())
    .lte("scheduled_at", cutoff);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  if (!due || due.length === 0) return Response.json({ ok: true, reminded: 0 });

  let reminded = 0;
  for (const m of due as { id: string; title: string | null; scheduled_at: string; invite_code: string | null; duration_minutes: number | null }[]) {
    // Claim it first so it can't double-fire.
    const { data: claimed } = await supabase
      .from("matches")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", m.id)
      .is("reminder_sent_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    const when = new Date(m.scheduled_at);
    const matchDate = when.toLocaleDateString("en-GB", { timeZone: "Europe/Malta", weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    const matchTime = when.toLocaleTimeString("en-GB", { timeZone: "Europe/Malta", hour: "2-digit", minute: "2-digit" });
    const signupFormUrl = m.invite_code ? `${BASE}/invite/${m.invite_code}` : `${BASE}/player-portal/games`;
    const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(`Join my LaserOps game (${m.title || "match"}) on ${matchDate}: ${signupFormUrl}`)}`;

    const { data: signups } = await supabase.from("match_signups").select("account_id").eq("match_id", m.id).eq("status", "registered");
    for (const s of (signups ?? []) as { account_id: string | null }[]) {
      if (!s.account_id) continue;
      await emitNotification(supabase, s.account_id, "match_reminder", {
        title: m.title || "Match reminder",
        body: `Your game is on ${matchDate} at ${matchTime}.`,
        href: `/player-portal/games/${m.id}`,
        data: { matchDate, matchTime, matchTimeRange: matchTimeRangeLabel(m.scheduled_at, m.duration_minutes), signupFormUrl, whatsappShareUrl },
      });
    }
    reminded++;
  }

  return Response.json({ ok: true, reminded });
}
