/**
 * app/api/cron/notifications-dispatch/route.ts
 * --------------------------------------------------------------------
 * Sends the emails for notifications whose type has email on. Picks up rows that
 * are due (deliver_at <= now) and not yet emailed, substitutes {{title}}/{{body}}
 * /{{link}} into the type's HTML template, sends via Resend, and stamps
 * email_sent_at so each fires once. A row may carry its own email_from /
 * email_sender_name (set by the admin broadcast composer) which overrides the
 * type's sender for that one send. Guarded by CRON_SECRET, service role.
 */
import type { NextRequest } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/service";
import { buildEmailTokens, renderEmailTemplate, resolveSender } from "@/lib/email-tokens";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.laseropsmalta.com";

type Row = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  data: Record<string, unknown> | null;
  email_from: string | null;
  email_sender_name: string | null;
  account: { email: string | null; ops_tag: string | null } | null;
  type: { sends_email: boolean; email_subject: string | null; email_html: string | null; email_from: string | null; email_sender_name: string | null; email_reply_to: string | null } | null;
};

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createServiceClient();
  if (!supabase) return Response.json({ ok: false, error: "Service role not configured." }, { status: 500 });
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  if (!resend) return Response.json({ ok: false, error: "Email not configured." }, { status: 500 });

  // Site-wide email config (sender identity + template tokens).
  const { data: cfgRows } = await supabase.from("email_config").select("key, value");
  const config = Object.fromEntries(((cfgRows ?? []) as { key: string; value: string | null }[]).map((r) => [r.key, r.value ?? ""]));
  const { data: rewardRows } = await supabase.from("reward_images").select("key, image_url");
  const gameTokenImg = ((rewardRows ?? []) as { key: string; image_url: string | null }[]).find((r) => r.key === "game_token")?.image_url;
  if (gameTokenImg) config.tokenImageUrl = gameTokenImg;
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, href, data, email_from, email_sender_name, account:accounts(email, ops_tag), type:notification_types(sends_email, email_subject, email_html, email_from, email_sender_name, email_reply_to)")
    .is("email_sent_at", null)
    .lte("deliver_at", new Date().toISOString())
    .limit(50);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.type?.sends_email && r.type.email_html && r.account?.email);

  let sent = 0;
  for (const r of rows) {
    const link = r.href ? (r.href.startsWith("http") ? r.href : `${BASE_URL}${r.href}`) : BASE_URL;
    const tokens = buildEmailTokens(config, { opsTag: r.account!.ops_tag, title: r.title, body: r.body, link, data: r.data });
    const html = renderEmailTemplate(r.type!.email_html as string, tokens);
    // Per-send sender (admin broadcast) wins over the type's, which wins over config.
    const sender = resolveSender(config, {
      from: r.email_from ?? r.type!.email_from,
      senderName: r.email_sender_name ?? r.type!.email_sender_name,
      replyTo: r.type!.email_reply_to,
    });
    try {
      await resend.emails.send({
        from: sender.from,
        replyTo: sender.replyTo,
        to: [r.account!.email as string],
        subject: r.type!.email_subject || r.title,
        html,
      });
      sent++;
    } catch (err) {
      console.error("[notifications-dispatch] send failed:", err);
      continue; // leave email_sent_at null to retry next run
    }
    await supabase.from("notifications").update({ email_sent_at: new Date().toISOString() }).eq("id", r.id);
  }

  return Response.json({ ok: true, sent });
}
