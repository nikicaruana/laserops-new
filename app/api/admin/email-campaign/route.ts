/**
 * app/api/admin/email-campaign/route.ts
 * --------------------------------------------------------------------
 * Admin creates an EMAIL-ONLY broadcast (no bell notification) to the opted-in
 * mailing list. Audience is locked server-side to accounts with
 * marketing_opt_in = true and a non-null email - the admin can't widen it. It
 * snapshots the recipient list into email_campaign_recipients and lets the
 * email-campaigns cron do the actual sending in batches. Admin-gated.
 * Body: { subject?, title, body?, href?, fromEmail?, senderName? }.
 */
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type Account = { id: string; email: string | null; ops_tag: string | null };

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return Response.json({ ok: false, error: "Admins only." }, { status: 403 });

  let body: { subject?: string; title?: string; body?: string; href?: string; fromEmail?: string; senderName?: string; typeKey?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const ALLOWED_TEMPLATES = new Set(["admin_broadcast", "launch_announcement"]);
  const typeKey = ALLOWED_TEMPLATES.has((body.typeKey ?? "").trim()) ? (body.typeKey as string).trim() : "admin_broadcast";
  const title = (body.title ?? "").trim();
  // admin_broadcast fills the title/body into the template; the launch template is self-contained.
  if (typeKey === "admin_broadcast" && !title) return Response.json({ ok: false, error: "A title is required." }, { status: 400 });

  const svc = createServiceClient();
  if (!svc) return Response.json({ ok: false, error: "Server not configured." }, { status: 500 });

  // Template must be active.
  const { data: type } = await svc.from("notification_types").select("is_active, email_subject").eq("key", typeKey).maybeSingle();
  if (!type || !type.is_active) return Response.json({ ok: false, error: "That email template is disabled." }, { status: 400 });
  const subject = (body.subject ?? "").trim() || (type.email_subject as string | null) || title || "LaserOps Malta";

  // Audience is locked: opted-in accounts with an email. Paginate to be safe.
  const audience: Account[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await svc
      .from("accounts")
      .select("id, email, ops_tag")
      .eq("marketing_opt_in", true)
      .not("email", "is", null)
      .range(from, from + PAGE - 1);
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    const rows = (data ?? []) as Account[];
    audience.push(...rows);
    if (rows.length < PAGE) break;
  }

  // De-dupe by lower(email) so a person with two accounts isn't emailed twice.
  const seen = new Set<string>();
  const recipients = audience.filter((a) => {
    const key = (a.email ?? "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (recipients.length === 0) return Response.json({ ok: false, error: "No opted-in recipients with an email." }, { status: 400 });

  const { data: me } = await svc.from("accounts").select("id").eq("auth_user_id", user.id).maybeSingle();

  const { data: campaignRow, error: campErr } = await svc
    .from("email_campaigns")
    .insert({
      created_by: (me as { id: string } | null)?.id ?? null,
      subject,
      title: title || subject,
      type_key: typeKey,
      body: body.body?.trim() || null,
      href: body.href?.trim() || null,
      email_from: body.fromEmail?.trim() || null,
      email_sender_name: body.senderName?.trim() || null,
      audience: "marketing_opt_in",
      total: recipients.length,
      status: "sending",
    })
    .select("id")
    .single();
  if (campErr || !campaignRow) return Response.json({ ok: false, error: campErr?.message || "Could not create campaign." }, { status: 500 });
  const campaignId = (campaignRow as { id: string }).id;

  const rows = recipients.map((a) => ({
    campaign_id: campaignId,
    account_id: a.id,
    email: (a.email as string).trim(),
    ops_tag: a.ops_tag,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await svc.from("email_campaign_recipients").insert(rows.slice(i, i + 500));
    if (error) return Response.json({ ok: false, error: error.message, campaignId }, { status: 500 });
  }

  return Response.json({ ok: true, campaignId, total: recipients.length });
}
