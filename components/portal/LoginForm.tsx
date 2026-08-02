"use client";

/**
 * components/portal/LoginForm.tsx
 * --------------------------------------------------------------------
 * Sign-in only (account creation lives on /player-portal/signup). Primary
 * path is email + password; alternatives are a magic link and Google.
 * "Forgot?" switches to the reset-request view. After a successful password
 * sign-in we send new/unfinished accounts to onboarding.
 */
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { GoogleButton } from "@/components/portal/GoogleButton";
import { postAuthPath } from "@/lib/portalRoute";

const inputStyles =
  "h-14 w-full rounded-none border border-border-strong bg-bg-elevated px-4 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";

async function destinationFor(
  supabase: ReturnType<typeof createClient>,
  next?: string,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return next ?? "/player-portal";
  const { data: account } = await supabase
    .from("accounts")
    .select("ops_tag, waiver_accepted_at")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  // A fully-onboarded player returns to where they came from (e.g. a match
  // invite). New / unfinished accounts still go through onboarding / waiver.
  if (next && account?.ops_tag && account?.waiver_accepted_at) return next;
  return postAuthPath(account);
}

export function LoginForm({ hadError, next }: { hadError?: boolean; next?: string }) {
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    hadError ? "Something went wrong signing you in. Please try again." : null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  const redirectTo = (path = "/auth/callback") => `${window.location.origin}${path}`;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const supabase = createClient();

    if (forgot) {
      if (!email.trim()) return;
      setBusy(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectTo("/auth/callback?next=/player-portal/reset-password"),
      });
      setBusy(false);
      if (error) setError(error.message);
      else setNotice(`If an account exists for ${email}, we've emailed a reset link.`);
      return;
    }

    if (!email.trim() || !password) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    window.location.assign(await destinationFor(supabase, next));
  }

  async function magicLink() {
    if (!email.trim()) {
      setError("Enter your email first, then tap the magic-link option.");
      return;
    }
    setError(null);
    setNotice(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectTo(
          next ? `/auth/callback?next=${encodeURIComponent(next)}` : "/auth/callback",
        ),
      },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setNotice(`We sent a one-time sign-in link to ${email}.`);
  }

  return (
    <div className="border border-border bg-bg-elevated px-6 py-8 sm:px-8">
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
            Email
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputStyles}
          />
        </label>

        {!forgot && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                Password
              </span>
              <button
                type="button"
                onClick={() => {
                  setForgot(true);
                  setError(null);
                  setNotice(null);
                }}
                className="text-xs text-text-subtle hover:text-accent"
              >
                Forgot?
              </button>
            </div>
            <PasswordInput
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
            />
          </div>
        )}

        {error && (
          <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>
        )}
        {notice && (
          <p className="border border-accent bg-bg px-4 py-3 text-sm text-accent">{notice}</p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : forgot ? "Reset password" : "Sign in"}
        </Button>
      </form>

      {forgot ? (
        <div className="mt-4 text-center text-xs text-text-subtle">
          <button
            type="button"
            onClick={() => {
              setForgot(false);
              setError(null);
              setNotice(null);
            }}
            className="hover:text-accent"
          >
            ← Back to sign in
          </button>
        </div>
      ) : (
        <>
          <div className="my-6 flex items-center gap-4">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-[0.12em] text-text-subtle">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-3">
            <GoogleButton label="Continue with Google" next={next} />
            <button
              type="button"
              onClick={magicLink}
              disabled={busy}
              className="w-full text-center text-xs uppercase tracking-[0.12em] text-text-subtle hover:text-accent disabled:opacity-50"
            >
              Email me a one-time sign-in link instead
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-text-subtle">
            New here?{" "}
            <Link href="/player-portal/signup" className="text-text-muted hover:text-accent">
              Create an account
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
