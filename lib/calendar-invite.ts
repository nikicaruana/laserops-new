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
import { resolveMatchLocation } from "@/lib/locations";
import { isBookingCalendarConfigured } from "@/lib/google-calendar";

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
  location_id: string | null;
};

export async function sendMatchInvites(
  matchId: string,
  method: "REQUEST" | "CANCEL",
  opts?: { onlyAccountId?: string; includeBusiness?: boolean; skipAlreadyInvited?: boolean },
): Promise<{ ok: boolean; sent: number; reason?: string }> {
  const svc = createServiceClient();
  if (!svc) return { ok: false, sent: 0, reason: "service-role-missing" };
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return { ok: false, sent: 0, reason: "resend-missing" };

  const { data: match } = await svc
    .from("matches")
    .select("id, title, match_code, scheduled_at, calendar_sequence, location_id")
    .eq("id", matchId)
    .maybeSingle();
  const m = match as MatchRow | null;
  if (!m?.scheduled_at) return { ok: false, sent: 0, reason: "no-schedule" };

  type AccountEmbed = { email: string | null; full_name: string | null };
  type SignupRow = { id: string; invite_sent_at: string | null; account: AccountEmbed | AccountEmbed[] | null };
  // A recipient carries its signup row id so a successful REQUEST send can stamp
  // invite_sent_at. That stamp is what makes a re-send idempotent per player: a
  // later manual re-send (or new-signup invite) skips anyone already invited.
  type Recipient = { email: string; name: string | null; signupId: string | null };
  // skipAlreadyInvited: only email players not yet invited. Set by the manual
  // "Send calendar invite" button and the new-signup / waitlist paths, so they
  // don't spam the roster. Reschedule/cancel leave it off (they reach everyone).
  const skipSent = opts?.skipAlreadyInvited === true;
  let recipients: Recipient[];
  if (opts?.onlyAccountId) {
    // Single-player send (someone who signed up AFTER the game was confirmed):
    // invite just that player, not the whole roster again.
    const { data: signup } = await svc
      .from("match_signups")
      .select("id, invite_sent_at, account:accounts(email, full_name)")
      .eq("match_id", matchId)
      .eq("account_id", opts.onlyAccountId)
      .eq("status", "registered")
      .maybeSingle<SignupRow>();
    const acc = signup ? (Array.isArray(signup.account) ? signup.account[0] : signup.account) : null;
    const already = Boolean(signup?.invite_sent_at);
    recipients =
      acc?.email && signup && !(skipSent && already)
        ? [{ email: acc.email, name: acc.full_name, signupId: signup.id }]
        : [];
  } else {
    let q = svc
      .from("match_signups")
      .select("id, invite_sent_at, account:accounts(email, full_name)")
      .eq("match_id", matchId)
      .eq("status", "registered");
    if (skipSent) q = q.is("invite_sent_at", null);
    const { data: signupRows } = await q;
    recipients = ((signupRows ?? []) as unknown as SignupRow[])
      .map((r): Recipient | null => {
        const a = Array.isArray(r.account) ? r.account[0] : r.account;
        return a?.email ? { email: a.email, name: a.full_name ?? null, signupId: r.id } : null;
      })
      .filter((r): r is Recipient => r !== null);
  }

  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.laseropsmalta.com";
  const gameUrl = `${appUrl}/player-portal/games/${m.id}`;
  const label = m.title || m.match_code || "LaserOps game";
  const loc = await resolveMatchLocation(m.location_id);
  const locationName = loc?.name || LOCATION;
  const mapsHtml = [locationName, loc?.playingUrl ? `<a href="${loc.playingUrl}" style="color:#111;">Directions</a>` : "", loc?.parkingUrl ? `<a href="${loc.parkingUrl}" style="color:#111;">Parking</a>` : ""].filter(Boolean).join(" &middot; ");
  const start = new Date(m.scheduled_at);
  const end = new Date(start.getTime() + SESSION_MINUTES * 60_000);
  const businessAttendee: IcsAttendee = { email: BUSINESS_EMAIL, name: BUSINESS_NAME };

  // Build the .ics for one recipient's attendee list. A PLAYER's invite lists
  // only that player (GDPR data minimisation) - never the other players' email
  // addresses - with the business as the organiser. The business's own copy
  // carries the full roster, since it runs the game.
  const icsContentFor = (attendees: IcsAttendee[]): string => {
    const ics = buildIcs({
      uid: `match-${m.id}@laseropsmalta.com`,
      sequence: m.calendar_sequence ?? 0,
      method,
      summary: method === "CANCEL" ? `Cancelled: ${label}` : label,
      description: `Your LaserOps game.\nDetails: ${gameUrl}`,
      location: loc?.playingUrl || locationName,
      url: gameUrl,
      start,
      end,
      stamp: new Date(),
      organizerName: BUSINESS_NAME,
      organizerEmail: BUSINESS_EMAIL,
      attendees,
    });
    return Buffer.from(ics).toString("base64");
  };

  const resend = new Resend(resendKey);
  const contentType = `text/calendar; charset=utf-8; method=${method}`;
  const cancelled = method === "CANCEL";
  const when = start.toLocaleString("en-GB", { timeZone: "Europe/Malta", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const subject = cancelled ? `Cancelled: ${label}` : `Calendar invite: ${label}`;
  const bodyHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;font-family:Arial,sans-serif;background:#fff;color:#111;">
  <h2 style="margin:0 0 4px;font-size:20px;">${cancelled ? "This game was cancelled" : label}</h2>
  <p style="margin:0 0 4px;font-size:13px;color:#666;">${when}</p>
  <p style="margin:0 0 16px;font-size:13px;color:#666;">${mapsHtml}</p>
  <p style="margin:0 0 16px;font-size:14px;">${cancelled ? "The calendar event has been removed." : "Add this to your calendar - the invite is attached. Your place is confirmed:"}</p>
  ${cancelled ? "" : `<p style="margin:0;"><a href="${gameUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;font-size:13px;font-weight:700;">Open the game</a></p>`}
</body></html>`;

  // One send per recipient, each with its OWN invite attachment. A player's
  // invite lists only that player (plus the business as organiser), so no player
  // ever sees another player's email address; the business's copy lists everyone.
  let sent = 0;
  let lastError: string | null = null;
  const sendInvite = async (to: string, attendees: IcsAttendee[], signupId: string | null): Promise<void> => {
    try {
      const { error } = await resend.emails.send({
        from: FROM,
        to: [to],
        subject,
        html: bodyHtml,
        attachments: [{ filename: "invite.ics", content: icsContentFor(attendees), contentType }],
      });
      // Resend returns { error } (it does NOT throw) for API-level failures such
      // as a bad key, an unverified domain or a rejected recipient. Record it and
      // do NOT count the send, so callers see the true outcome instead of a false
      // success. One failed invite still shouldn't stop the rest.
      if (error) {
        lastError = error.message || "send rejected";
        return;
      }
      sent++;
      // Stamp the player as invited so a later re-send skips them. REQUEST only -
      // a CANCEL shouldn't mark anyone as freshly invited.
      if (signupId && method === "REQUEST") {
        await svc.from("match_signups").update({ invite_sent_at: new Date().toISOString() }).eq("id", signupId);
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : "send failed";
    }
  };
  for (const p of recipients) {
    await sendInvite(p.email, [{ email: p.email, name: p.name }], p.signupId);
  }
  // Business copy (full roster). Always on a roster-wide send; on a single-player
  // send only when explicitly asked, so a new signup doesn't spam the business.
  // SKIP it entirely when the booking-calendar API is configured - that owns the
  // business event (written straight onto the shared calendar), so emailing
  // bookings@ too would create a duplicate.
  const includeBusiness =
    (opts?.onlyAccountId ? opts.includeBusiness === true : true) && !isBookingCalendarConfigured();
  if (includeBusiness) {
    await sendInvite(
      BUSINESS_EMAIL,
      [...recipients.map((r) => ({ email: r.email, name: r.name })), businessAttendee],
      null,
    );
  }
  return { ok: sent > 0, sent, reason: sent === 0 ? lastError ?? "no-recipients" : undefined };
}
