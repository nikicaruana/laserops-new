/**
 * app/admin/notifications/[key]/page.tsx
 * --------------------------------------------------------------------
 * Edit a single notification type.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NotificationTypeEditor, type NotificationType } from "@/components/admin/NotificationTypeEditor";

export const metadata = { title: "Edit notification" };

export default async function EditNotificationTypePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const supabase = await createClient();
  const [{ data }, { data: cfgRows }] = await Promise.all([
    supabase
      .from("notification_types")
      .select("key, label, description, priority, is_active, bell_title, bell_body, sends_email, email_subject, email_html, sends_push, delay_hours, email_from, email_sender_name, email_reply_to")
      .eq("key", key)
      .maybeSingle(),
    supabase.from("email_config").select("key, value"),
  ]);
  if (!data) notFound();
  const config = Object.fromEntries(((cfgRows ?? []) as { key: string; value: string | null }[]).map((r) => [r.key, r.value ?? ""]));

  return (
    <div>
      <div className="mb-6 text-xs">
        <Link href="/admin/notifications" className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">← Notifications</Link>
      </div>
      <h1 className="mb-6 text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">{(data as NotificationType).label}</h1>
      <NotificationTypeEditor initial={data as NotificationType} config={config} />
    </div>
  );
}
