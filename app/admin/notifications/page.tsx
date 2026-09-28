/**
 * app/admin/notifications/page.tsx
 * --------------------------------------------------------------------
 * Admin catalogue of notification types: priority, email/push toggles, active.
 * Click through to edit one (copy, priority, email HTML). Lower priority number
 * shows higher in a player's bell (1 = top).
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminAlertTypesTable } from "@/components/admin/AdminAlertTypesTable";

export const metadata = { title: "Notifications" };

type AdminAlertRow = { key: string; label: string; description: string | null; priority: number; is_active: boolean };

type Row = {
  key: string;
  label: string;
  priority: number;
  is_active: boolean;
  sends_email: boolean;
  sends_push: boolean;
  delay_hours: number;
};

export default async function AdminNotificationsPage() {
  const supabase = await createClient();
  const [{ data }, { data: adminData }] = await Promise.all([
    supabase
      .from("notification_types")
      .select("key, label, priority, is_active, sends_email, sends_push, delay_hours")
      .order("sort_order", { nullsFirst: false })
      .order("priority"),
    supabase
      .from("admin_notification_types")
      .select("key, label, description, priority, is_active")
      .order("sort_order", { nullsFirst: false })
      .order("priority"),
  ]);
  const rows = (data ?? []) as Row[];
  const adminRows = (adminData ?? []) as AdminAlertRow[];

  const dot = (on: boolean) => (on ? <span className="text-accent">Yes</span> : <span className="text-text-subtle/60">No</span>);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Notifications</h1>
          <p className="mt-2 text-sm text-text-muted">
            {rows.length} notification types. Priority sets bell order (1 = top). Toggle whether each also emails the player and edit the email HTML.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/notifications/email-settings"
            className="flex h-11 items-center gap-2 border border-border-strong px-5 text-xs font-bold uppercase tracking-[0.12em] text-text transition-colors hover:border-accent hover:text-accent"
          >
            Email settings
          </Link>
          <Link
            href="/admin/notifications/broadcast"
            className="flex h-11 items-center gap-2 border border-accent bg-accent px-5 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98]"
          >
            Send a notification
          </Link>
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">
          No notification types yet.
        </p>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-elevated text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
                <th className="px-4 py-3 font-semibold">Notification</th>
                <th className="px-4 py-3 text-center font-semibold">Priority</th>
                <th className="px-4 py-3 text-center font-semibold">Email</th>
                <th className="px-4 py-3 text-center font-semibold">Push</th>
                <th className="px-4 py-3 text-center font-semibold">Delay</th>
                <th className="px-4 py-3 text-center font-semibold">Active</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-border last:border-0 hover:bg-bg-elevated/50">
                  <td className="px-4 py-3 font-semibold text-text">{r.label}</td>
                  <td className="px-4 py-3 text-center font-mono tabular-nums text-accent">{r.priority}</td>
                  <td className="px-4 py-3 text-center">{dot(r.sends_email)}</td>
                  <td className="px-4 py-3 text-center">{dot(r.sends_push)}</td>
                  <td className="px-4 py-3 text-center text-text-muted">{r.delay_hours > 0 ? `${r.delay_hours}h` : "None"}</td>
                  <td className="px-4 py-3 text-center">{r.is_active ? <span className="text-accent">●</span> : <span className="text-text-subtle/50">○</span>}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/notifications/${r.key}`} className="text-xs font-bold uppercase tracking-[0.12em] text-accent hover:text-accent-soft">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Admin panel alerts – enable / disable each operational alert type */}
      <section className="mt-10">
        <div className="mb-4 border-b border-border pb-4">
          <h2 className="text-lg font-extrabold uppercase tracking-tight text-text">Admin panel alerts</h2>
          <p className="mt-1.5 text-sm text-text-muted">
            The operational alerts shown in the admin bell and dashboard. Turn one off to stop it raising new alerts
            (existing ones stay). Priority sets order (1 = top).
          </p>
        </div>
        {adminRows.length === 0 ? (
          <p className="border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">
            No admin alert types found. Run the admin-notifications migration.
          </p>
        ) : (
          <AdminAlertTypesTable initial={adminRows} />
        )}
      </section>
    </div>
  );
}
