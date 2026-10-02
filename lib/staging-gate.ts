/**
 * lib/staging-gate.ts
 * --------------------------------------------------------------------
 * Closed-group staging controls. Entirely INERT in dev and production: every
 * helper is a no-op unless STAGING_GATE=1 is set in the environment (we only set
 * it on the Vercel staging deployment). Edge-runtime safe (env + string ops).
 *
 *   STAGING_GATE=1                     -> turn the email gate + noindex on
 *   STAGING_ALLOWED_EMAILS=a@b.com,@laseropsmalta.com,...
 *                                       -> who may use the staging site. An entry
 *                                          starting with "@" allows a whole domain.
 *
 * When the gate is on, anyone whose signed-in email is not on the list is sent to
 * /closed-beta. Webhooks, crons, auth, the login pages, and APIs stay reachable
 * (see GATE_EXEMPT_PREFIXES) so sign-in and integrations keep working.
 */

/** True on the staging deployment (email gate + noindex active). */
export function isStagingGateEnabled(): boolean {
  return process.env.STAGING_GATE === "1";
}

/**
 * True when this deploy should be hidden from search engines: the explicit gate
 * flag, or a host that looks like a staging alias.
 */
export function isStagingHost(): boolean {
  if (isStagingGateEnabled()) return true;
  try {
    const host = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "").host.toLowerCase();
    return host.startsWith("staging.") || host.startsWith("preview.");
  } catch {
    return false;
  }
}

function allowlist(): string[] {
  return (process.env.STAGING_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s !== "");
}

/** Is this signed-in email allowed on staging? Exact match, or "@domain" entry. */
export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  if (e === "") return false;
  for (const entry of allowlist()) {
    if (entry.startsWith("@")) {
      if (e.endsWith(entry)) return true;
    } else if (e === entry) {
      return true;
    }
  }
  return false;
}

/**
 * Paths that must stay reachable even when the gate is on, so sign-in and
 * server-to-server calls keep working: the notice page itself, the auth flow,
 * the login/signup pages, and all API routes (webhooks, crons, revalidate -
 * these carry their own auth). Static assets are already excluded by the matcher.
 */
const GATE_EXEMPT_PREFIXES = [
  "/closed-beta",
  "/auth",
  "/api",
  "/player-portal/login",
  "/player-portal/signup",
];

export function isGateExemptPath(pathname: string): boolean {
  return GATE_EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?"));
}
