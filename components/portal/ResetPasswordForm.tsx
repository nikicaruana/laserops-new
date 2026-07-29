"use client";

/**
 * components/portal/ResetPasswordForm.tsx
 * --------------------------------------------------------------------
 * Sets a new password. Reached from the emailed reset link, which returns
 * through /auth/callback -> here with a recovery session already active.
 * If there's no session (link expired / opened cold), we say so instead of
 * silently failing.
 */
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";

const MIN_PASSWORD = 8;

export function ResetPasswordForm() {
  const [ready, setReady] = useState<boolean | null>(null); // null = checking
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setReady(!!data.user));
  }, []);

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
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(error.message);
    else setDone(true);
  }

  if (ready === null) {
    return <p className="text-center text-sm text-text-muted">Checking your link…</p>;
  }

  if (!ready) {
    return (
      <div className="border border-border bg-bg-elevated px-6 py-8 text-center">
        <p className="text-sm text-text-muted">
          This reset link is invalid or has expired. Head back and request a new one.
        </p>
        <a
          href="/player-portal/login"
          className="mt-4 inline-block text-xs uppercase tracking-[0.12em] text-accent hover:underline"
        >
          Back to sign in
        </a>
      </div>
    );
  }

  if (done) {
    return (
      <div className="border border-accent bg-bg-elevated px-6 py-8 text-center">
        <p className="text-sm text-text">Password updated. You&apos;re all set.</p>
        <a
          href="/player-portal"
          className="mt-4 inline-block text-xs uppercase tracking-[0.12em] text-accent hover:underline"
        >
          Go to the portal
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="border border-border bg-bg-elevated px-6 py-8 sm:px-8">
      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
          New password
        </span>
        <PasswordInput
          required
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={`At least ${MIN_PASSWORD} characters`}
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
          Confirm new password
        </span>
        <PasswordInput
          required
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Re-enter new password"
        />
      </label>

      {error && (
        <p className="mt-4 border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="mt-4 w-full" disabled={busy}>
        {busy ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
