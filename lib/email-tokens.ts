/**
 * lib/email-tokens.ts
 * --------------------------------------------------------------------
 * Email template token engine, driven by the email_config table (see the
 * migration). A template's {{token}} placeholders are filled from, merged in
 * order (later wins):
 *   1. email_config values  - keys double as tokens: {{logoUrl}}, {{instagramUrl}} ...
 *   2. per-player tokens     - {{nickname}}, {{opsTag}}, {{playerProfileUrl}}
 *   3. built-ins             - {{title}}, {{body}}, {{link}}
 *   4. per-notification data - {{matchId}}, {{matchReportUrl}}, ... from notifications.data
 * The *UrlTemplate config values are themselves rendered against the gathered
 * tokens, producing {{playerProfileUrl}} (from {{nickname}}) and
 * {{matchReportUrl}} (from {{matchId}}). Unknown tokens render as "".
 */
import { brand } from "@/lib/brand";
import { isAllowedSender, defaultSenderEmail } from "./email-domains";

export type EmailConfig = Record<string, string>;

/** Replace every {{token}} with its value; unknown tokens become "". */
export function renderEmailTemplate(html: string, tokens: Record<string, unknown>): string {
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const v = tokens[key];
    return v == null ? "" : String(v);
  });
}

/** Build the full token map for one recipient + notification. */
export function buildEmailTokens(
  config: EmailConfig,
  opts: { opsTag?: string | null; title?: string | null; body?: string | null; link?: string | null; data?: Record<string, unknown> | null },
): Record<string, string> {
  const tag = (opts.opsTag ?? "").trim();
  const tokens: Record<string, string> = {
    ...config,
    siteUrl: (config.siteUrl || brand.siteUrl).replace(/\/$/, ""),
    nickname: tag || "there",
    opsTag: tag,
    title: opts.title ?? "",
    body: opts.body ?? "",
    link: opts.link ?? "",
  };
  if (opts.data) {
    for (const [k, v] of Object.entries(opts.data)) if (v != null) tokens[k] = String(v);
  }
  // Resolve the templated URLs. Encode the dynamic value tokens (ops tag, match
  // code, any data values) so spaces/symbols make a valid query string; leave
  // brand/base URL tokens untouched.
  const dynamicKeys = new Set(["nickname", "opsTag", ...Object.keys(opts.data ?? {})]);
  const urlSafe: Record<string, string> = {};
  for (const [k, v] of Object.entries(tokens)) urlSafe[k] = dynamicKeys.has(k) ? encodeURIComponent(v) : v;
  if (config.playerProfileUrlTemplate) tokens.playerProfileUrl = renderEmailTemplate(config.playerProfileUrlTemplate, urlSafe);
  if (config.matchReportUrlTemplate) tokens.matchReportUrl = renderEmailTemplate(config.matchReportUrlTemplate, urlSafe);
  // Expand {{siteUrl}} inside any config value that references it (gameCalendarUrl,
  // bookingUrl, ...), so one NEXT_PUBLIC_SITE_URL controls every email link.
  for (const [k, v] of Object.entries(tokens)) {
    if (typeof v === "string" && v.includes("{{siteUrl}}")) tokens[k] = renderEmailTemplate(v, urlSafe);
  }
  return tokens;
}

/** Resolve the From / Reply-To for one email: per-type override, else config. */
export function resolveSender(
  config: EmailConfig,
  override?: { from?: string | null; senderName?: string | null; replyTo?: string | null } | null,
): { from: string; replyTo: string | undefined } {
  let fromEmail = (override?.from || config.fromEmail || "bookings@laseropsmalta.com").trim();
  if (!isAllowedSender(fromEmail)) {
    console.warn(`[email] From "${fromEmail}" is not on a verified sending domain; using ${defaultSenderEmail()}.`);
    fromEmail = defaultSenderEmail();
  }
  const senderName = (override?.senderName || config.senderName || "LaserOps").trim();
  const replyTo = (override?.replyTo || config.replyToEmail || "").trim();
  return { from: `${senderName} <${fromEmail}>`, replyTo: replyTo || undefined };
}

/** Sample token map (for admin previews) from the current config. */
export function sampleEmailTokens(config: EmailConfig): Record<string, string> {
  return buildEmailTokens(config, {
    opsTag: "Kini",
    title: "Sample notification title",
    body: "This is a preview of the message body.",
    link: "#",
    data: {
      matchId: "LO-2026-10",
      matchDate: "Sat, 13 Sep 2026",
      matchTime: "14:00",
      signupFormUrl: "https://www.laseropsmalta.com/invite/ABCD",
      whatsappShareUrl: "https://wa.me/?text=Join%20my%20LaserOps%20game",
      matchLocationUrl: config.matchLocationUrl || "https://maps.google.com/?q=LaserOps+Malta",
      parkingUrl: config.parkingUrl || "https://maps.google.com/?q=Parking",
    },
  });
}

/** Documentation shown in the admin editor so admins know what they can use. */
export const TOKEN_REFERENCE: { token: string; desc: string }[] = [
  { token: "title", desc: "Notification title" },
  { token: "body", desc: "Notification message" },
  { token: "link", desc: "Primary link for this notification" },
  { token: "nickname", desc: "Recipient's ops tag (name)" },
  { token: "opsTag", desc: "Recipient's ops tag" },
  { token: "playerProfileUrl", desc: "Link to the recipient's profile" },
  { token: "matchId", desc: "Match code (match-related emails)" },
  { token: "matchReportUrl", desc: "Link to the match report (match-related emails)" },
  { token: "matchDate", desc: "Match date (match / reminder emails)" },
  { token: "matchTime", desc: "Match start time (reminder emails)" },
  { token: "matchLocationUrl", desc: "Venue location link" },
  { token: "parkingUrl", desc: "Parking location link" },
  { token: "signupFormUrl", desc: "Share / invite link for the match (reminder emails)" },
  { token: "whatsappShareUrl", desc: "WhatsApp share link for the match (reminder emails)" },
  { token: "logoUrl", desc: "Brand logo image URL" },
  { token: "siteUrl", desc: "Site base URL" },
  { token: "gameCalendarUrl", desc: "Open games / calendar" },
  { token: "bookingUrl", desc: "Booking page" },
  { token: "instagramUrl", desc: "Instagram profile" },
  { token: "facebookUrl", desc: "Facebook page" },
  { token: "instagramIconUrl", desc: "Instagram icon image" },
  { token: "facebookIconUrl", desc: "Facebook icon image" },
  { token: "whatsappCommunityUrl", desc: "WhatsApp community invite" },
  { token: "googleReviewUrl", desc: "Google review link" },
];
