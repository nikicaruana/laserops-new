"use client";

/**
 * components/portal/LoginForm.tsx
 * --------------------------------------------------------------------
 * Player-portal sign-in. Primary path is email + password (no email sent
 * per login — saves the transactional-email quota). Alternatives: a magic
 * link and Google OAuth.
 *
 * Modes:
 *   signin  — email + password -> signInWithPassword
 *   signup  — email + password -> signUp (sends ONE confirmation email;
 *             confirmation MUST stay enabled because the account-claim
 *             trigger links by email — otherwise it's an takeover vector)
 *   forgot  — email -> resetPasswordForEmail (link -> /reset-password)
 *
 * All email links (confirm, magic, reset) return through /auth/callback.
 */
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

type Mode = "signin" | "signup" | "forgot";

const inputStyles =
  "h-14 w-full rounded-none border border-border-strong bg-bg-elevated px-4 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";

const MIN_PASSWORD = 8;

export function LoginForm({ hadError }: { hadError?: boolean }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    hadError ? "Something went wrong signing you in. Please try again." : null,
  );
  // Non-error confirmations ("check your email …") shown in a neutral panel.
  const [notice, setNotice] = useState<string | null>(null);

  const redirectTo = (path = "/auth/callback") =>
    `${window.location.origin}${path}`;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const supabase = createClient();

    if (mode === "forgot") {
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
    if (mode === "signup" && password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }

    setBusy(true);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      setBusy(false);
      if (error) {
        setError(error.message);
      } else {
        // Session is set; go to the portal.
        window.location.assign("/player-portal");
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: redirectTo() },
      });
      setBusy(false);
      if (error) {
        setError(error.message);
      } else if (data.session) {
        // Confirmation disabled -> already signed in.
        window.location.assign("/player-portal");
      } else {
        setNotice(
          `Almost there — we've emailed a confirmation link to ${email}. Click it to finish creating your account.`,
        );
      }
    }
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
      options: { emailRedirectTo: redirectTo() },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setNotice(`We sent a one-time sign-in link to ${email}.`);
  }

  async function google() {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (error) setError(error.message);
  }

  const title =
    mode === "signin"
      ? "Sign in"
      : mode === "signup"
        ? "Create account"
        : "Reset password";

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

        {mode !== "forgot" && (
          <label className="block">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                Password
              </span>
              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setError(null);
                    setNotice(null);
                  }}
                  className="text-xs text-text-subtle hover:text-accent"
                >
                  Forgot?
                </button>
              )}
            </div>
            <input
              type="password"
              required
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={mode === "signup" ? MIN_PASSWORD : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? `At least ${MIN_PASSWORD} characters` : "Your password"}
              className={inputStyles}
            />
          </label>
        )}

        {error && (
          <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
            {error}
          </p>
        )}
        {notice && (
          <p className="border border-accent bg-bg px-4 py-3 text-sm text-accent">
            {notice}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : title}
        </Button>
      </form>

      {/* Mode switching */}
      <div className="mt-4 text-center text-xs text-text-subtle">
        {mode === "signin" && (
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(null); setNotice(null); }}
            className="hover:text-accent"
          >
            Need an account? <span className="text-text-muted">Create one</span>
          </button>
        )}
        {mode === "signup" && (
          <button
            type="button"
            onClick={() => { setMode("signin"); setError(null); setNotice(null); }}
            className="hover:text-accent"
          >
            Already have an account? <span className="text-text-muted">Sign in</span>
          </button>
        )}
        {mode === "forgot" && (
          <button
            type="button"
            onClick={() => { setMode("signin"); setError(null); setNotice(null); }}
            className="hover:text-accent"
          >
            ← Back to sign in
          </button>
        )}
      </div>

      {/* Alternatives */}
      {mode !== "forgot" && (
        <>
          <div className="my-6 flex items-center gap-4">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-[0.12em] text-text-subtle">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={google}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-none border border-border-strong bg-bg px-8 text-sm font-semibold uppercase tracking-[0.12em] text-text transition-colors hover:border-accent active:scale-[0.98]"
            >
              <GoogleGlyph />
              Continue with Google
            </button>
            <button
              type="button"
              onClick={magicLink}
              disabled={busy}
              className="w-full text-center text-xs uppercase tracking-[0.12em] text-text-subtle hover:text-accent disabled:opacity-50"
            >
              Email me a one-time sign-in link instead
            </button>
          </div>
        </>
      )}
    </div>
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
