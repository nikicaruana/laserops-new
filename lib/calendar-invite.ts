/**
 * lib/calendar-invite.ts
 * --------------------------------------------------------------------
 * Sends .ics calendar invites for a match to every registered player and to the
 * business, via Resend. The business is the ORGANIZER (its address matches the
 * send-from, so calendar clients trust the invite) and is also an attendee so the
 * event lands on its Google Calendar. Used on confirm (REQUEST), reschedule
 * (REQUEST with a bumped SEQUENCE) and cancel (CANCEL). Best-effort: email
 * failures never throw. All server-side (needs the service role + RESEND_API_KEY).
 */
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/service";
import { buildIcs, type IcsAttendee } from "@/lib/ics";

const BUSINESS_EMAIL = "bookings@laseropsmalta.com";
const BUSINESS_NAME = "LaserOps Malta";
const FROM = `LaserOps <${BUSINESS_EMAIL}>`;
const LOCATION = "LaserOps Malta";
const SESSION_MINUTES = 180; // ~3h session, matches the booking finish-by rule.

type MatchRow = {
  id: string;
  title: string | null;
  match_code: string | null;
  scheduled_at: string | null;
  calendar_sequence: number | null;
};

export async function sendMatchInvites(matchId: string, method: "REQUEST" | "CANCEL"): Promise<{ ok: boolean; sent: number; reason?: string }> {
  const svc = createServiceClient();
  if (!svc) return { ok: false, sent: 0, reason: "service-role-missing" };
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return { ok: false, sent: 0, reason: "resend-missing" };

  const { data: match } = await svc
    .from("matches")
    .select("id, title, match_code, scheduled_at, calendar_sequence")
    .eq("id", matchId)
    .maybeSingle();
  const m = match as MatchRow | null;
  if (!m?.scheduled_at) return { ok: false, sent: 0, reason: "no-schedule" };

  const { data: signupRows } = await svc
    .from("match_signups")
    .select("account:accounts(email, full_name)")
    .eq("match_id", matchId)
    .eq("status", "registered");
  type AccountEmbed = { email: string | null; full_name: string | null };
  const players: IcsAttendee[] = ((signupRows ?? []) as unknown as { account: AccountEmbed | AccountEmbed[] | null }[])
    .map((r) => (Array.isArray(r.account) ? r.account[0] : r.account))
    .filter((a): a is AccountEmbed => Boolean(a?.email))
    .map((a) => ({ email: a.email as string, name: a.full_name }));

  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://laseropsmalta.com";
  const gameUrl = `${appUrl}/player-portal/games/${m.id}`;
  const label = m.title || m.match_code || "LaserOps game";
  const start = new Date(m.scheduled_at);
  const end = new Date(start.getTime() + SESSION_MINUTES * 60_000);
  const attendees: IcsAttendee[] = [...players, { email: BUSINESS_EMAIL, name: BUSINESS_NAME }];

  const ics = buildIcs({
    uid: `match-${m.id}@laseropsmalta.com`,
    sequence: m.calendar_sequence ?? 0,
    method,
    summary: method === "CANCEL" ? `Cancelled: ${label}` : label,
    description: `Your LaserOps match.\\nDetails and payment: ${gameUrl}`,
    location: LOCATION,
    url: gameUrl,
    start,
    end,
    stamp: new Date(),
    organizerName: BUSINESS_NAME,
    organizerEmail: BUSINESS_EMAIL,
    attendees,
  });

  const resend = new Resend(resendKey);
  const contentType = `text/calendar; charset=utf-8; method=${method}`;
  const content = Buffer.from(ics).toString("base64");
  const cancelled = method === "CANCEL";
  const when = start.toLocaleString("en-GB", { timeZone: "Europe/Malta", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const subject = cancelled ? `Cancelled: ${label}` : `Calendar invite: ${label}`;
  const bodyHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;font-family:Arial,sans-serif;background:#fff;color:#111;">
  <h2 style="margin:0 0 4px;font-size:20px;">${cancelled ? "This game was cancelled" : label}</h2>
  <p style="margin:0 0 16px;font-size:13px;color:#666;">${when}</p>
  <p style="margin:0 0 16px;font-size:14px;">${cancelled ? "The calendar event has been removed." : "Add this to your calendar - the invite is attached. Confirm your place and pay online:"}</p>
  ${cancelled ? "" : `<p style="margin:0;"><a href="${gameUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;font-size:13px;font-weight:700;">Open the game</a></p>`}
</body></html>`;

  // One send per recipient (players + business), so each gets their own invite.
  const recipients = [...players.map((p) => p.email), BUSINESS_EMAIL];
  let sent = 0;
  for (const to of recipients) {
    try {
      await resend.emails.send({
        from: FROM,
        to: [to],
        subject,
        html: bodyHtml,
        attachments: [{ filename: "invite.ics", content, contentType }],
      });
      sent++;
    } catch {
      // Keep going; one failed invite shouldn't stop the rest.
    }
  }
  return { ok: true, sent };
}
