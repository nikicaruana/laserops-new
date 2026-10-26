/**
 * app/admin/layout.tsx
 * --------------------------------------------------------------------
 * Admin area shell. Server-gated: only signed-in admins (is_admin()) get in;
 * everyone else is redirected. Entry also requires a 2FA-elevated (aal2)
 * session - AdminStepUpGate covers the panel until the admin enters a code. All
 * config edits below the shell write directly to the config tables through the
 * admin's authenticated session, enforced by the `<table>_admin_write` RLS
 * policies.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/AdminNav";
import { SelectNumberOnFocus } from "@/components/admin/SelectNumberOnFocus";
import { AdminIdleLock } from "@/components/admin/AdminIdleLock";
import { AdminStepUpGate } from "@/components/admin/AdminStepUpGate";
import { DemoMask } from "@/components/admin/DemoMask";

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

  // Require a 2FA-elevated session to use the admin panel at all.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const needsStepUp = aal?.currentLevel !== "aal2";
  const canStepUp = aal?.nextLevel === "aal2"; // has a verified factor to step up with

  return (
    <div className="min-h-screen bg-bg">
      {/* Restore Demo Mode (customer-data blur) pre-paint so it doesn't flash off
          on navigation between admin pages. Toggled by DemoModeToggle in the nav. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(localStorage.getItem('laserops:demo-mode')==='1')document.documentElement.setAttribute('data-demo','on')}catch(e){}`,
        }}
      />
      <SelectNumberOnFocus />
      <DemoMask />
      <AdminIdleLock />
      {needsStepUp && <AdminStepUpGate canStepUp={canStepUp} />}
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row lg:gap-10 lg:px-8 lg:py-12">
        <AdminNav />
        <main id="admin-main" className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
