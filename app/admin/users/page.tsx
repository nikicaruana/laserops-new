/**
 * app/admin/users/page.tsx
 * --------------------------------------------------------------------
 * Manage admin users. Lists current admins + grant/revoke. Admin-only, so
 * email is shown. Reads accounts via the admin session (admin RLS).
 */
import { createClient } from "@/lib/supabase/server";
import { UserManager, type AdminUser } from "@/components/admin/UserManager";

export const metadata = { title: "User management" };

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: adminRows }, { data: self }, { data: statsRows }] = await Promise.all([
    supabase.from("accounts").select("id, ops_tag, email").eq("is_admin", true).order("ops_tag"),
    user
      ? supabase.from("accounts").select("id").eq("auth_user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.rpc("admin_user_stats"),
  ]);
  const stats = (Array.isArray(statsRows) ? statsRows[0] : statsRows) as
    | { total_accounts: number; claimed_accounts: number; migrated_accounts: number; logged_in_24h: number }
    | null
    | undefined;

  return (
    <div>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
          User management
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Grant or revoke admin access. Admins can manage all game config and see this page.
        </p>
      </header>

      {stats && (
        <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total players" value={stats.total_accounts} hint="Everyone in the system" />
          <StatCard label="Registered accounts" value={stats.claimed_accounts} hint="Signed up or claimed a profile (includes merged stats)" />
          <StatCard label="Migrated (unclaimed)" value={stats.migrated_accounts} hint="Imported from the Sheets database, not yet claimed" />
          <StatCard label="Active in last 24h" value={stats.logged_in_24h} hint="Logged in within the last 24 hours" />
        </section>
      )}

      <UserManager
        admins={(adminRows ?? []) as AdminUser[]}
        selfAccountId={(self as { id: string } | null)?.id ?? null}
      />
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="border border-border bg-bg-elevated p-4">
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-text-muted">{label}</p>
      <p className="mt-1 font-mono text-3xl font-extrabold tabular-nums text-accent">{Number(value ?? 0).toLocaleString("en-US")}</p>
      {hint && <p className="mt-1 text-[0.65rem] leading-snug text-text-subtle">{hint}</p>}
    </div>
  );
}
