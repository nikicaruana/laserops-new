/**
 * lib/ics.ts
 * --------------------------------------------------------------------
 * Minimal RFC 5545 iCalendar builder for match invites. Produces a VCALENDAR
 * with one VEVENT, a stable UID per match (so updates replace rather than
 * duplicate), a SEQUENCE for updates, and METHOD REQUEST (invite / update) or
 * CANCEL (event removed). Attendees get RSVP; the business is the organiser so
 * the event also lands on its calendar.
 */
export type IcsAttendee = { email: string; name?: string | null };

export type BuildIcsOpts = {
  /** Stable per-match id, e.g. "match-<uuid>@laseropsmalta.com". */
  uid: string;
  /** Increases on each update (reschedule). */
  sequence: number;
  method: "REQUEST" | "CANCEL";
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  start: Date;
  end: Date;
  /** Timestamp for DTSTAMP; pass an explicit value (no Date.now in callers of pure fns). */
  stamp: Date;
  organizerName: string;
  organizerEmail: string;
  attendees: IcsAttendee[];
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** UTC basic format: YYYYMMDDTHHMMSSZ. */
function fmt(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** Escape text per RFC 5545 (backslash, comma, semicolon, newlines). */
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold lines longer than 75 octets (approximated by chars). */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length) parts.push(" " + rest);
  return parts.join("\r\n");
}

export function buildIcs(opts: BuildIcsOpts): string {
  const cancelled = opts.method === "CANCEL";
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LaserOps Malta//Bookings//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${opts.method}`,
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `SEQUENCE:${opts.sequence}`,
    `DTSTAMP:${fmt(opts.stamp)}`,
    `DTSTART:${fmt(opts.start)}`,
    `DTEND:${fmt(opts.end)}`,
    `SUMMARY:${esc(opts.summary)}`,
    `ORGANIZER;CN=${esc(opts.organizerName)}:mailto:${opts.organizerEmail}`,
    `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`,
  ];
  if (opts.location) lines.push(`LOCATION:${esc(opts.location)}`);
  if (opts.description) lines.push(`DESCRIPTION:${esc(opts.description)}`);
  if (opts.url) lines.push(`URL:${opts.url}`);
  for (const a of opts.attendees) {
    const cn = a.name ? `;CN=${esc(a.name)}` : "";
    lines.push(`ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE${cn}:mailto:${a.email}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(fold).join("\r\n");
}
