/**
 * lib/notifications.ts - server-side emit helper.
 * Calls the emit_notification RPC (definer; only service_role may execute it),
 * so always pass a SERVICE-ROLE client. Never blocks the caller on failure.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function emitNotification(
  svc: SupabaseClient,
  accountId: string,
  typeKey: string,
  opts: { title: string; body?: string | null; href?: string | null; data?: Record<string, unknown> | null; deliverAt?: string | null },
): Promise<void> {
  try {
    await svc.rpc("emit_notification", {
      p_account_id: accountId,
      p_type_key: typeKey,
      p_title: opts.title,
      p_body: opts.body ?? null,
      p_href: opts.href ?? null,
      p_data: opts.data ?? null,
      p_deliver_at: opts.deliverAt ?? null,
    });
  } catch (err) {
    console.error(`[notify] emit ${typeKey} failed:`, err);
  }
}
