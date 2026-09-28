/**
 * lib/supabase/server.ts
 * --------------------------------------------------------------------
 * Server-side Supabase client (Server Components, Route Handlers, Server
 * Actions). Reads/writes the auth session from the request cookies so the
 * signed-in user's identity flows into every query – meaning RLS runs as
 * that user (they see/edit only their own account row, etc.).
 *
 * Still the anon key, not the service role: we want RLS enforced here.
 * Reserve the service role for trusted backend jobs that must bypass RLS
 * (none of the request-path code should need it).
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component (cookies are read-only there).
            // Safe to ignore – the middleware refreshes the session cookie.
          }
        },
      },
    },
  );
}
