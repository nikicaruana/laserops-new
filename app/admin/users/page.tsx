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

  const [{ data: adminRows }, { data: self }] = await Promise.all([
    supabase.from("accounts").select("id, ops_tag, email").eq("is_admin", true).order("ops_tag"),
    user
      ? supabase.from("accounts").select("id").eq("auth_user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

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

      <UserManager
        admins={(adminRows ?? []) as AdminUser[]}
        selfAccountId={(self as { id: string } | null)?.id ?? null}
      />
    </div>
  );
}
