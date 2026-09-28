/**
 * app/admin/notifications/email-settings/page.tsx
 * --------------------------------------------------------------------
 * Edit the site-wide email config (logo, socials, links, sender identity, URL
 * templates) that fills email templates and sets the sender on notification
 * emails.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmailConfigEditor } from "@/components/admin/EmailConfigEditor";

export const metadata = { title: "Email settings" };

export default async function EmailSettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("email_config").select("key, value").order("key");
  const rows = ((data ?? []) as { key: string; value: string | null }[]).map((r) => ({ key: r.key, value: r.value ?? "" }));

  return (
    <div>
      <div className="mb-6 text-xs">
        <Link href="/admin/notifications" className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">← Notifications</Link>
      </div>
      <h1 className="mb-2 text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Email settings</h1>
      <p className="mb-6 text-sm text-text-muted">
        These values fill every email template (as tokens like {"{{logoUrl}}"}) and set the sender + reply-to on notification emails. The URL templates build per-player and per-match links.
      </p>
      <EmailConfigEditor initial={rows} />
    </div>
  );
}
