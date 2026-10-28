/**
 * lib/google-calendar.ts
 * --------------------------------------------------------------------
 * Writes booking events DIRECTLY onto the shared "LaserOps Malta Bookings"
 * Google Calendar via the Calendar API (service-account auth). A confirmed game
 * then appears on that calendar automatically - no emailed-invite "accept" step,
 * correct source calendar, no junk guests. Players still get their own .ics email
 * invites (lib/calendar-invite.ts); this owns ONLY the business/booking copy.
 *
 * Config (server-only; every function no-ops cleanly if absent):
 *   GOOGLE_SERVICE_ACCOUNT_KEY  - the service-account JSON key (raw JSON or base64)
 *   GOOGLE_BOOKING_CALENDAR_ID  - target calendar id (c_...@group.calendar.google.com)
 * The service account must be shared on that calendar with "Make changes to events".
 *
 * Auth is the service-account JWT-bearer flow, signed with node:crypto (RS256) -
 * no extra npm dependency.
 */
import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveMatchLocation } from "@/lib/locations";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/calendar";
const TZ = "Europe/Malta";
const DEFAULT_MINUTES = 180;

type Creds = { clientEmail: string; privateKey: string; calendarId: string };

function getCreds(): Creds | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const calendarId = process.env.GOOGLE_BOOKING_CALENDAR_ID;
  if (!raw || !calendarId) return null;
  try {
    const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const json = JSON.parse(text) as { client_email?: string; private_key?: string };
    if (!json.client_email || !json.private_key) return null;
    // A key pasted raw into an env var can arrive with literal "\n" instead of
    // real newlines; normalise so the PEM parses.
    return { clientEmail: json.client_email, privateKey: json.private_key.replace(/\\n/g, "\n"), calendarId };
  } catch {
    return null;
  }
}

/** Whether the booking-calendar API is set up. When true, the email path skips the
 *  business copy (this owns it) to avoid a duplicate on the booking calendar. */
export function isBookingCalendarConfigured(): boolean {
  return getCreds() !== null;
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(c: Creds): Promise<string | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claim = b64url(JSON.stringify({ iss: c.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }));
    const signingInput = `${header}.${claim}`;
    const signature = b64url(crypto.createSign("RSA-SHA256").update(signingInput).sign(c.privateKey));
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${signingInput}.${signature}` }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

type MatchRow = {
  id: string;
  title: string | null;
  match_code: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  location_id: string | null;
  google_event_id: string | null;
};

function eventBody(m: MatchRow, locationText: string, gameUrl: string) {
  const start = new Date(m.scheduled_at as string);
  const end = new Date(start.getTime() + (m.duration_minutes ?? DEFAULT_MINUTES) * 60_000);
  return {
    summary: m.title || m.match_code || "LaserOps game",
    description: `Details: ${gameUrl}`,
    location: locationText,
    start: { dateTime: start.toISOString(), timeZone: TZ },
    end: { dateTime: end.toISOString(), timeZone: TZ },
    source: { title: "LaserOps", url: gameUrl },
  };
}

/**
 * Create or update the booking-calendar event for a match, storing the Google
 * event id on the match so later updates/cancels target it (no duplicates).
 * No-op (ok:false + reason) if unconfigured or the match has no schedule.
 */
export async function syncBookingCalendar(matchId: string): Promise<{ ok: boolean; eventId?: string; reason?: string }> {
  const c = getCreds();
  if (!c) return { ok: false, reason: "not-configured" };
  const svc = createServiceClient();
  if (!svc) return { ok: false, reason: "service-role-missing" };

  const { data } = await svc
    .from("matches")
    .select("id, title, match_code, scheduled_at, duration_minutes, location_id, google_event_id")
    .eq("id", matchId)
    .maybeSingle();
  const m = data as MatchRow | null;
  if (!m?.scheduled_at) return { ok: false, reason: "no-schedule" };

  const token = await getAccessToken(c);
  if (!token) return { ok: false, reason: "auth-failed" };

  const loc = await resolveMatchLocation(m.location_id);
  const locationText = loc?.playingUrl || loc?.name || "LaserOps Malta";
  const appUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.laseropsmalta.com").replace(/\/$/, "");
  const gameUrl = `${appUrl}/player-portal/games/${m.id}`;
  const body = JSON.stringify(eventBody(m, locationText, gameUrl));
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(c.calendarId)}/events`;
  const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const insert = async (): Promise<{ ok: boolean; eventId?: string; reason?: string }> => {
    const r = await fetch(base, { method: "POST", headers: authHeaders, body });
    if (!r.ok) return { ok: false, reason: `insert-http-${r.status}` };
    const j = (await r.json()) as { id?: string };
    if (j.id) await svc.from("matches").update({ google_event_id: j.id }).eq("id", m.id);
    return { ok: true, eventId: j.id };
  };

  if (m.google_event_id) {
    const r = await fetch(`${base}/${encodeURIComponent(m.google_event_id)}`, { method: "PATCH", headers: authHeaders, body });
    if (r.ok) {
      const j = (await r.json()) as { id?: string };
      return { ok: true, eventId: j.id };
    }
    // The stored event was deleted on the calendar - recreate it.
    if (r.status === 404 || r.status === 410) return insert();
    return { ok: false, reason: `patch-http-${r.status}` };
  }
  return insert();
}

/** Delete the booking-calendar event for a match (on cancel). No-op if none. */
export async function removeBookingCalendar(matchId: string): Promise<{ ok: boolean; reason?: string }> {
  const c = getCreds();
  if (!c) return { ok: false, reason: "not-configured" };
  const svc = createServiceClient();
  if (!svc) return { ok: false, reason: "service-role-missing" };

  const { data } = await svc.from("matches").select("google_event_id").eq("id", matchId).maybeSingle();
  const eventId = (data?.google_event_id as string | null) ?? null;
  if (!eventId) return { ok: true }; // nothing on the calendar

  const token = await getAccessToken(c);
  if (!token) return { ok: false, reason: "auth-failed" };

  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(c.calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const ok = r.ok || r.status === 404 || r.status === 410;
  if (ok) await svc.from("matches").update({ google_event_id: null }).eq("id", matchId);
  return { ok, reason: ok ? undefined : `delete-http-${r.status}` };
}
