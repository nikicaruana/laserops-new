/**
 * lib/email.ts
 * --------------------------------------------------------------------
 * Direct transactional email (Resend), for messages that aren't tied to a
 * per-account notification row - e.g. a gift email to a recipient who has no
 * account yet, or a buyer's purchase confirmation. Uses the same sender identity
 * and {{token}} templating as the notification dispatcher, so these look
 * consistent with the rest of the mail. Server-only; never blocks the caller.
 */
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/service";
import { buildEmailTokens, renderEmailTemplate, resolveSender } from "@/lib/email-tokens";

/**
 * Send one email. Either pass `rawHtml`, or `typeKey` to render a stored
 * notification-type template with {{title}}/{{body}}/{{link}} substituted.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  rawHtml?: string;
  typeKey?: string;
  title?: string;
  body?: string;
  link?: string;
  opsTag?: string | null;
  data?: Record<string, unknown> | null;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("[email] RESEND_API_KEY missing - cannot send.");
    return false;
  }
  const svc = createServiceClient();
  if (!svc) return false;

  const { data: cfgRows } = await svc.from("email_config").select("key, value");
  const config = Object.fromEntries(((cfgRows ?? []) as { key: string; value: string | null }[]).map((r) => [r.key, r.value ?? ""]));
  const { data: rewardRows } = await svc.from("reward_images").select("key, image_url");
  const gameTokenImg = ((rewardRows ?? []) as { key: string; image_url: string | null }[]).find((r) => r.key === "game_token")?.image_url;
  if (gameTokenImg) config.tokenImageUrl = gameTokenImg;
  let html = opts.rawHtml ?? null;
  let sender = resolveSender(config); // global default; a per-type override may replace it below
  if (opts.typeKey) {
    const { data: t } = await svc
      .from("notification_types")
      .select("email_html, email_from, email_sender_name, email_reply_to")
      .eq("key", opts.typeKey)
      .maybeSingle();
    if (t) {
      sender = resolveSender(config, { from: t.email_from as string | null, senderName: t.email_sender_name as string | null, replyTo: t.email_reply_to as string | null });
      if (!html && t.email_html) {
        const tokens = buildEmailTokens(config, {
          opsTag: opts.opsTag ?? null,
          title: opts.title ?? "",
          body: opts.body ?? "",
          link: opts.link ?? "",
          data: opts.data ?? null,
        });
        html = renderEmailTemplate(t.email_html as string, tokens);
      }
    }
  }
  if (!html) html = `<p>${opts.body ?? ""}</p>`;

  const resend = new Resend(key);
  try {
    await resend.emails.send({ from: sender.from, replyTo: sender.replyTo, to: [opts.to], subject: opts.subject, html });
    return true;
  } catch (err) {
    console.error("[email] send failed:", err);
    return false;
  }
}
