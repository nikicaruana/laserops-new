/**
 * lib/supabase/middleware.ts
 * --------------------------------------------------------------------
 * Session-refresh helper called from the root middleware. Supabase auth
 * tokens are short-lived; this refreshes them on every (matched) request and
 * writes the rotated cookies back onto the response so Server Components always
 * see a valid session. Returns the refreshed response AND the current user, so
 * the staging gate can read the signed-in email without a second round-trip.
 *
 * IMPORTANT: do not run other logic between createServerClient and
 * getUser() – it must be the first await, per Supabase's SSR guidance, or you
 * risk logging users out at random.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Supabase not configured (e.g. env not set) – skip auth refresh rather than
  // crash the portal. Public pages (leaderboards) still render; sign-in is
  // simply unavailable until the keys are present.
  if (!url || !anonKey) return { response, user: null };

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Refresh the session (rotates the token cookie when needed).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
