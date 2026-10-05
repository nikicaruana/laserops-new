/**
 * app/api/cron/email-campaigns/route.ts
 * --------------------------------------------------------------------
 * Drains email-only broadcast campaigns (the opted-in mailing list sendout).
 * Picks the oldest campaign still "sending", takes up to BATCH pending
 * recipients, renders the admin_broadcast HTML template per recipient (so
 * {{nickname}} etc. resolve), and sends them in one Resend batch. Successful
 * rows get email_sent stamped; a failed batch records the error and retries on
 * the next run. When a campaign has no pending recipients left it flips to
 * "done". Guarded by CRON_SECRET, service role. Schedule: every couple of mins.
 */
import type { NextRequest } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/service";
import { buildEmailTokens, renderEmailTemplate, resolveSender } from "@/lib/email-tokens";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.laseropsmalta.com";
const BATCH = 100; // Resend batch.send caps at 100 emails per request.

type Campaign = {
  id: string;
  type_key: string;
  subject: string;
  title: string;
  body: string | null;
  href: string | null;
  email_from: string | null;
  email_sender_name: string | null;
};
type Recipient = { id: string; email: string; ops_tag: string | null };

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createServiceClient();
  if (!supabase) return Response.json({ ok: false, error: "Service role not configured." }, { status: 500 });
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  if (!resend) return Response.json({ ok: false, error: "Email not configured." }, { status: 500 });

  // Oldest campaign still sending.
  const { data: camp } = await supabase
    .from("email_campaigns")
    .select("id, subject, title, body, href, email_from, email_sender_name, type_key")
    .eq("status", "sending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!camp) return Response.json({ ok: true, done: true, sent: 0 });
  const campaign = camp as Campaign;

  // Next slice of pending recipients for this campaign.
  const { data: recRows } = await supabase
    .from("email_campaign_recipients")
    .select("id, email, ops_tag")
    .eq("campaign_id", campaign.id)
    .is("sent_at", null)
    .limit(BATCH);
  const recipients = (recRows ?? []) as Recipient[];

  if (recipients.length === 0) {
    await supabase.from("email_campaigns").update({ status: "done" }).eq("id", campaign.id);
    return Response.json({ ok: true, campaignId: campaign.id, finished: true, sent: 0 });
  }

  // Template + sender (shared across the batch).
  const { data: cfgRows } = await supabase.from("email_config").select("key, value");
  const config = Object.fromEntries(((cfgRows ?? []) as { key: string; value: string | null }[]).map((r) => [r.key, r.value ?? ""]));
  const { data: rewardRows } = await supabase.from("reward_images").select("key, image_url");
  const gameTokenImg = ((rewardRows ?? []) as { key: string; image_url: string | null }[]).find((r) => r.key === "game_token")?.image_url;
  if (gameTokenImg) config.tokenImageUrl = gameTokenImg;
  const { data: type } = await supabase.from("notification_types").select("email_html").eq("key", campaign.type_key).maybeSingle();
  const template = (type?.email_html as string | undefined) ?? "";
  const sender = resolveSender(config, { from: campaign.email_from, senderName: campaign.email_sender_name, replyTo: null });
  const link = campaign.href ? (campaign.href.startsWith("http") ? campaign.href : `${BASE_URL}${campaign.href}`) : BASE_URL;

  const payload = recipients.map((r) => {
    const tokens = buildEmailTokens(config, { opsTag: r.ops_tag, title: campaign.title, body: campaign.body, link, data: null });
    return {
      from: sender.from,
      replyTo: sender.replyTo,
      to: [r.email],
      subject: campaign.subject,
      html: renderEmailTemplate(template, tokens),
    };
  });

  const nowIso = new Date().toISOString();
  const ids = recipients.map((r) => r.id);
  try {
    const { error } = await resend.batch.send(payload);
    if (error) throw new Error(error.message || "batch send failed");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email-campaigns] batch failed:", message);
    // Record the error; leave sent_at null so the next run retries this slice.
    await supabase.from("email_campaign_recipients").update({ error: message }).in("id", ids);
    return Response.json({ ok: false, campaignId: campaign.id, error: message, retrying: ids.length }, { status: 502 });
  }

  await supabase.from("email_campaign_recipients").update({ sent_at: nowIso, error: null }).in("id", ids);

  // Advance campaign counters and finish if this was the last slice.
  const { count: remaining } = await supabase
    .from("email_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaign.id)
    .is("sent_at", null);
  const { count: sentCount } = await supabase
    .from("email_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaign.id)
    .not("sent_at", "is", null);
  await supabase
    .from("email_campaigns")
    .update({ sent: sentCount ?? 0, status: (remaining ?? 0) === 0 ? "done" : "sending" })
    .eq("id", campaign.id);

  return Response.json({ ok: true, campaignId: campaign.id, sent: ids.length, remaining: remaining ?? 0 });
}
