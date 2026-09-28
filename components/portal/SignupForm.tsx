"use client";

/**
 * components/portal/SignupForm.tsx
 * --------------------------------------------------------------------
 * Dedicated account-creation form (distinct from the login page). Player
 * enters email + a password (twice), we sign them up (which emails a
 * confirmation link). Confirming returns through /auth/callback, which then
 * sends them to onboarding to pick a callsign + photo. Google is offered as
 * an alternative and follows the same onboarding path.
 */
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { GoogleButton } from "@/components/portal/GoogleButton";

const inputStyles =
  "h-14 w-full rounded-none border border-border bg-bg-overlay px-4 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";

const MIN_PASSWORD = 8;

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);

    if (error) {
      setError(error.message);
    } else if (data.session) {
      // Confirmation disabled -> straight to onboarding.
      window.location.assign("/player-portal/onboarding");
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="border border-accent bg-bg-elevated px-8 py-10 text-center">
        <h2 className="text-lg font-semibold uppercase tracking-[0.12em] text-accent">
          Confirm your email
        </h2>
        <p className="mt-3 text-sm text-text-muted">
          We sent a confirmation link to <span className="text-text">{email}</span>. Open it to
          finish creating your account and set up your profile.
        </p>
      </div>
    );
  }

  return (
    <div className="portal-card px-6 py-8 sm:px-8">
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

        <div>
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
            Password
          </span>
          <PasswordInput
            required
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`At least ${MIN_PASSWORD} characters`}
          />
        </div>

        <div>
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
            Confirm password
          </span>
          <PasswordInput
            required
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter password"
          />
        </div>

        {error && (
          <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-[0.12em] text-text-subtle">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <GoogleButton label="Sign up with Google" />

      <p className="mt-6 text-center text-xs text-text-subtle">
        Already have an account?{" "}
        <Link href="/player-portal/login" className="text-text-muted hover:text-accent">
          Sign in
        </Link>
      </p>
    </div>
  );
}
