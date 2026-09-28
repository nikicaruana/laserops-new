/**
 * app/admin/notifications/broadcast/page.tsx
 * --------------------------------------------------------------------
 * Admin one-off notification composer (announcements).
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BroadcastComposer } from "@/components/admin/BroadcastComposer";

export const metadata = { title: "Send a notification" };

export default async function BroadcastPage() {
  const supabase = await createClient();
  const [{ data }, { data: type }, { data: cfgRows }] = await Promise.all([
    supabase.from("squads").select("id, name").order("name"),
    supabase.from("notification_types").select("email_html").eq("key", "admin_broadcast").maybeSingle(),
    supabase.from("email_config").select("key, value"),
  ]);
  const squads = (data ?? []) as { id: string; name: string }[];
  const emailTemplate = (type?.email_html as string | undefined) ?? "";
  const config = Object.fromEntries(((cfgRows ?? []) as { key: string; value: string | null }[]).map((r) => [r.key, r.value ?? ""]));

  return (
    <div>
      <div className="mb-6 text-xs">
        <Link href="/admin/notifications" className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">← Notifications</Link>
      </div>
      <h1 className="mb-2 text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Send a notification</h1>
      <p className="mb-6 text-sm text-text-muted">A one-off announcement to everyone, a player, or a squad. It appears in their bell, and optionally emails them.</p>
      <BroadcastComposer squads={squads} emailTemplate={emailTemplate} config={config} />
    </div>
  );
}
