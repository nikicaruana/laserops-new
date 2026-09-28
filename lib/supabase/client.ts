/**
 * lib/supabase/client.ts
 * --------------------------------------------------------------------
 * Browser-side Supabase client (runs in Client Components).
 *
 * Uses the public anon key – safe to ship to the browser because every
 * table is guarded by Row-Level Security (see the RLS migrations). The
 * anon key can only read what the public-read policies allow and can only
 * touch a player's own account once they're signed in.
 *
 * Required env vars (both public):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
