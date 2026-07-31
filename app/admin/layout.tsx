/**
 * app/admin/layout.tsx
 * --------------------------------------------------------------------
 * Admin area shell. Server-gated: only signed-in admins (is_admin()) get in;
 * everyone else is redirected. All config edits below the shell write directly
 * to the config tables through the admin's authenticated session, enforced by
 * the `<table>_admin_write` RLS policies.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/AdminNav";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · LaserOps" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/player-portal/login?next=/admin");

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/player-portal/player-stats");

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row lg:gap-10 lg:px-8 lg:py-12">
        <AdminNav />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
