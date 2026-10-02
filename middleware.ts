/**
 * middleware.ts (root)
 * --------------------------------------------------------------------
 * Two jobs:
 *   1. Keep the Supabase auth session fresh on the routes that use it (the
 *      player portal, admin, auth callback, and the authed APIs). Marketing
 *      pages are static/ISR and get a cheap pass-through (no cookie writes), so
 *      their caching is untouched.
 *   2. Closed-group staging gate: when STAGING_GATE=1 (set only on the staging
 *      deployment), anyone whose signed-in email is not on STAGING_ALLOWED_EMAILS
 *      is sent to /closed-beta. Inert in dev and production. See lib/staging-gate.
 *
 * The matcher runs on everything except static assets so the gate can cover the
 * whole site; when the gate is off we only refresh the session where it matters.
 */
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isStagingGateEnabled, isEmailAllowed, isGateExemptPath } from "@/lib/staging-gate";

function needsSession(pathname: string): boolean {
  return (
    pathname === "/player-portal" ||
    pathname.startsWith("/player-portal/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/profile-pic") ||
    pathname.startsWith("/api/admin")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Closed-group staging gate (inert unless STAGING_GATE=1).
  if (isStagingGateEnabled()) {
    // Session refresh must be the first await (Supabase SSR guidance); it also
    // gives us the signed-in email to check against the allowlist.
    const { response, user } = await updateSession(request);
    if (isGateExemptPath(pathname)) return response;
    if (isEmailAllowed(user?.email)) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/closed-beta";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 2. Normal operation: refresh the session only where it matters.
  if (needsSession(pathname)) {
    const { response } = await updateSession(request);
    return response;
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except Next internals and static asset files. Keeps the gate
    // able to cover marketing pages on staging; a cheap pass-through otherwise.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|txt|xml|json|woff|woff2|ttf|map)$).*)",
  ],
};
