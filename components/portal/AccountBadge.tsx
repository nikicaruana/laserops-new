"use client";

/**
 * components/portal/AccountBadge.tsx
 * --------------------------------------------------------------------
 * Thin signed-in indicator for the top of the player portal.
 *
 * Deliberately a CLIENT component: reading the session server-side in the
 * shared portal layout would force every portal page (including the public,
 * ISR-cached leaderboards) to render dynamically. Reading it in the browser
 * keeps those pages statically cacheable. Sign-out posts to the server route
 * so the httpOnly auth cookies are cleared reliably.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function AccountBadge() {
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;
      if (!user) {
        setLabel(null);
        setLoading(false);
        return;
      }

      const { data: account } = await supabase
        .from("accounts")
        .select("ops_tag")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!active) return;
      setLabel(account?.ops_tag || user.email || "Signed in");
      setLoading(false);
    }

    load();

    // React to sign-in / sign-out happening in this or another tab.
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (loading) return <span className="h-4 w-16" aria-hidden />;

  if (!label) {
    return (
      <Link
        href="/player-portal/login"
        className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Link
        href="/player-portal/profile"
        className="text-xs font-semibold uppercase tracking-[0.12em] text-text hover:text-accent"
      >
        {label}
      </Link>
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="text-xs uppercase tracking-[0.12em] text-text-subtle hover:text-accent"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
