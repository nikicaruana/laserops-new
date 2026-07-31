/**
 * middleware.ts (root)
 * --------------------------------------------------------------------
 * Keeps the Supabase auth session fresh on the routes that actually use
 * it. Scoped deliberately narrow — the marketing pages are static/ISR and
 * have no auth UI, so there's no reason to run auth middleware there (and
 * running it everywhere would touch their caching). The player portal,
 * the auth callback, and the profile-pic API are where a session matters.
 */
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/player-portal/:path*",
    "/admin/:path*",
    "/auth/:path*",
    "/api/profile-pic/:path*",
  ],
};
