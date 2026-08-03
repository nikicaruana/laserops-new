/**
 * lib/supabase/service.ts
 * --------------------------------------------------------------------
 * Service-role Supabase client for TRUSTED SERVER JOBS ONLY (cron, webhooks).
 * Bypasses RLS entirely, so never expose it to a request that carries user
 * input without its own auth check. Uses SUPABASE_SERVICE_ROLE_KEY (server-only
 * secret — never NEXT_PUBLIC). Returns null if the key isn't configured.
 */
import { createClient } from "@supabase/supabase-js";

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
