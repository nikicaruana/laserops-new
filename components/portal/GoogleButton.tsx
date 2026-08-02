"use client";

/**
 * components/portal/GoogleButton.tsx
 * --------------------------------------------------------------------
 * Google OAuth button shared by login + signup. Returns through
 * /auth/callback, which routes new/unfinished accounts to onboarding.
 */
import { createClient } from "@/lib/supabase/client";

export function GoogleButton({ label, next }: { label: string; next?: string }) {
  async function signIn() {
    const supabase = createClient();
    const callback = next
      ? `/auth/callback?next=${encodeURIComponent(next)}`
      : "/auth/callback";
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${callback}` },
    });
  }

  return (
    <button
      type="button"
      onClick={signIn}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-none border border-border-strong bg-bg px-8 text-sm font-semibold uppercase tracking-[0.12em] text-text transition-colors hover:border-accent active:scale-[0.98]"
    >
      <GoogleGlyph />
      {label}
    </button>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.92v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.92a9 9 0 0 0 0 8.1l3.06-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .92 4.95l3.06 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}
