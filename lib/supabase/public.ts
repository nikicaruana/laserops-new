/**
 * lib/supabase/public.ts
 * --------------------------------------------------------------------
 * Cookieless Supabase client for PUBLIC, read-only config (anon key, no
 * session). Because it never touches request cookies, it does NOT opt a
 * page into dynamic rendering — so static / ISR marketing pages can read
 * public config (e.g. the weapons catalogue) from Supabase and still be
 * statically generated.
 *
 * Use this ONLY for anon-readable public data. For anything that depends
 * on the signed-in user (RLS as that user, their account row, etc.) use
 * the cookie-aware createClient() from ./server.
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
