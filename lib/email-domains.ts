/**
 * lib/email-domains.ts
 * --------------------------------------------------------------------
 * Guard so a From address is always on a Resend-verified sending domain.
 * Resend REJECTS mail sent From an unverified domain, which would silently
 * break notification emails. Admin From fields validate against this, and
 * resolveSender() falls back to a safe default if a bad value ever slips
 * through (e.g. set directly in the DB before validation existed).
 *
 * Verified domain(s) default to laseropsmalta.com; override with
 * NEXT_PUBLIC_RESEND_SENDING_DOMAINS (comma-separated) when you verify another
 * domain in Resend. Client-safe (pure); reads only a NEXT_PUBLIC_ env.
 */
const DEFAULT_DOMAINS = ["laseropsmalta.com"];

export function allowedSenderDomains(): string[] {
  const raw = (process.env.NEXT_PUBLIC_RESEND_SENDING_DOMAINS ?? "").trim();
  const list = (raw ? raw.split(",") : DEFAULT_DOMAINS).map((d) => d.trim().toLowerCase()).filter(Boolean);
  return list.length ? list : DEFAULT_DOMAINS;
}

/** The domain of a From value, which may be "Name <x@y.com>" or "x@y.com". */
export function senderDomainOf(value: string): string | null {
  const m = value.toLowerCase().match(/@([a-z0-9.-]+)>?\s*$/);
  return m ? m[1] : null;
}

export function isAllowedSender(value: string): boolean {
  const d = senderDomainOf((value ?? "").trim());
  return d != null && allowedSenderDomains().includes(d);
}

/** Error string if a (non-empty) From address is not on a verified domain; null if ok/empty. */
export function senderDomainError(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (v === "") return null;
  return isAllowedSender(v)
    ? null
    : `From address must be on a verified sending domain (${allowedSenderDomains().join(", ")}), or Resend will reject it.`;
}

/** A guaranteed-valid From email on the first verified domain, for fallback. */
export function defaultSenderEmail(): string {
  return `bookings@${allowedSenderDomains()[0]}`;
}
