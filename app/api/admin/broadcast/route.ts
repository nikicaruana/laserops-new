/**
 * app/api/admin/broadcast/route.ts
 * --------------------------------------------------------------------
 * Admin sends a one-off notification (announcement) to everyone, a single
 * player, or a squad. Inserts notification rows (type admin_broadcast) with the
 * service role. Email is per-send: when off we pre-stamp email_sent_at so the
 * dispatch cron skips it; when on we leave it null and the cron emails it using
 * the admin_broadcast HTML template. Admin-gated. Body:
 * { mode, opsTag?, squadId?, title, body?, href?, sendEmail }.
 */
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return Response.json({ ok: false, error: "Admins only." }, { status: 403 });

  let body: { mode?: string; opsTag?: string; squadId?: string; title?: string; body?: string; href?: string; sendEmail?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const title = (body.title ?? "").trim();
  if (!title) return Response.json({ ok: false, error: "A title is required." }, { status: 400 });

  const svc = createServiceClient();
  if (!svc) return Response.json({ ok: false, error: "Server not configured." }, { status: 500 });

  const { data: type } = await svc.from("notification_types").select("priority, is_active").eq("key", "admin_broadcast").maybeSingle();
  if (!type || !type.is_active) return Response.json({ ok: false, error: "Broadcasts are disabled." }, { status: 400 });

  // Resolve recipients.
  let accountIds: string[] = [];
  if (body.mode === "player") {
    const tag = (body.opsTag ?? "").trim();
    if (!tag) return Response.json({ ok: false, error: "Pick a player." }, { status: 400 });
    const { data } = await svc.from("accounts").select("id").ilike("ops_tag", tag).limit(1);
    accountIds = ((data ?? []) as { id: string }[]).map((a) => a.id);
    if (accountIds.length === 0) return Response.json({ ok: false, error: "No player with that ops tag." }, { status: 400 });
  } else if (body.mode === "squad") {
    if (!body.squadId) return Response.json({ ok: false, error: "Pick a squad." }, { status: 400 });
    const { data } = await svc.from("squad_members").select("account_id").eq("squad_id", body.squadId);
    accountIds = ((data ?? []) as { account_id: string }[]).map((m) => m.account_id);
  } else {
    // Everyone with a login.
    const { data } = await svc.from("accounts").select("id").not("auth_user_id", "is", null);
    accountIds = ((data ?? []) as { id: string }[]).map((a) => a.id);
  }
  accountIds = Array.from(new Set(accountIds));
  if (accountIds.length === 0) return Response.json({ ok: true, sent: 0 });

  const emailStamp = body.sendEmail ? null : new Date().toISOString();
  const rows = accountIds.map((id) => ({
    account_id: id,
    type_key: "admin_broadcast",
    priority: type.priority,
    title,
    body: body.body?.trim() || null,
    href: body.href?.trim() || null,
    email_sent_at: emailStamp,
  }));

  // Insert in chunks to stay well within row limits.
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await svc.from("notifications").insert(rows.slice(i, i + 500));
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, sent: accountIds.length, emailed: Boolean(body.sendEmail) });
}
