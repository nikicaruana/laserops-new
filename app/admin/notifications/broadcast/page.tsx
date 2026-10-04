/**
 * app/admin/notifications/broadcast/page.tsx
 * --------------------------------------------------------------------
 * Admin one-off notification composer (announcements) + email-only mailing-list
 * sendout. Loads the squads, the confirmed ops-tag list (for the recipient
 * picker), the default sender, and how many accounts are on the mailing list.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveSender } from "@/lib/email-tokens";
import { BroadcastComposer } from "@/components/admin/BroadcastComposer";

export const metadata = { title: "Send a notification" };

export default async function BroadcastPage() {
  const supabase = await createClient();
  const [{ data: squadRows }, { data: type }, { data: cfgRows }, { data: tagRows }, { count: optInCount }] = await Promise.all([
    supabase.from("squads").select("id, name").order("name"),
    supabase.from("notification_types").select("email_html, email_from, email_sender_name").eq("key", "admin_broadcast").maybeSingle(),
    supabase.from("email_config").select("key, value"),
    supabase.from("accounts").select("ops_tag").not("auth_user_id", "is", null).not("ops_tag", "is", null).order("ops_tag"),
    supabase.from("accounts").select("id", { count: "exact", head: true }).eq("marketing_opt_in", true).not("email", "is", null),
  ]);

  const squads = (squadRows ?? []) as { id: string; name: string }[];
  const emailTemplate = (type?.email_html as string | undefined) ?? "";
  const config = Object.fromEntries(((cfgRows ?? []) as { key: string; value: string | null }[]).map((r) => [r.key, r.value ?? ""]));
  const opsTags = Array.from(new Set(((tagRows ?? []) as { ops_tag: string | null }[]).map((r) => r.ops_tag).filter((t): t is string => Boolean(t))));

  // Default sender for the picker: the admin_broadcast type's override, else the global config default.
  const sender = resolveSender(config, { from: (type?.email_from as string | null) ?? null, senderName: (type?.email_sender_name as string | null) ?? null, replyTo: null });
  const defaultFromEmail = (sender.from.match(/<([^>]+)>/)?.[1] ?? "").trim();
  const defaultSenderName = sender.from.replace(/\s*<[^>]+>\s*$/, "").trim();

  return (
    <div>
      <div className="mb-6 text-xs">
        <Link href="/admin/notifications" className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">← Notifications</Link>
      </div>
      <h1 className="mb-2 text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Send a notification</h1>
      <p className="mb-6 text-sm text-text-muted">A one-off announcement to everyone, specific players, or a squad - shown in the bell and optionally emailed. Or send an email-only blast to your whole mailing list.</p>
      <BroadcastComposer
        squads={squads}
        opsTags={opsTags}
        emailTemplate={emailTemplate}
        config={config}
        defaultFromEmail={defaultFromEmail}
        defaultSenderName={defaultSenderName}
        mailingListCount={optInCount ?? 0}
      />
    </div>
  );
}
