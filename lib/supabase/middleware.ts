/**
 * lib/supabase/middleware.ts
 * --------------------------------------------------------------------
 * Session-refresh helper called from the root middleware. Supabase auth
 * tokens are short-lived; this refreshes them on every request and writes
 * the rotated cookies back onto the response so Server Components always
 * see a valid session.
 *
 * IMPORTANT: do not run other logic between createServerClient and
 * getClaims()/getUser() — it must be the first await, per Supabase's SSR
 * guidance, or you risk logging users out at random.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh the session (rotates the token cookie when needed).
  await supabase.auth.getUser();

  return response;
}
