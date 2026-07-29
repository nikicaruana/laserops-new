"use client";

/**
 * components/portal/LoginForm.tsx
 * --------------------------------------------------------------------
 * Sign-in card for the player portal. Two passwordless paths:
 *   - Magic link: enter email -> Supabase emails a one-time link.
 *   - Google: OAuth redirect.
 * Both return through /auth/callback, which exchanges the code for a
 * session. The account-claim trigger links the player's existing history
 * (matched by email) the moment their auth user is created.
 */
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

const inputStyles =
  "h-14 w-full rounded-none border border-border-strong bg-bg-elevated px-4 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";

export function LoginForm({ hadError }: { hadError?: boolean }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    hadError ? "error" : "idle",
  );
  const [message, setMessage] = useState<string>(
    hadError ? "Something went wrong signing you in. Please try again." : "",
  );

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
    }
  }

  async function signInWithGoogle() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    }
  }

  if (status === "sent") {
    return (
      <div className="border border-accent bg-bg-elevated px-8 py-10 text-center">
        <h2 className="text-lg font-semibold uppercase tracking-[0.12em] text-accent">
          Check your email
        </h2>
        <p className="mt-3 text-sm text-text-muted">
          We sent a sign-in link to <span className="text-text">{email}</span>.
          Open it on this device to log in.
        </p>
        <button
          onClick={() => {
            setStatus("idle");
            setEmail("");
          }}
          className="mt-6 text-xs uppercase tracking-[0.12em] text-text-subtle hover:text-accent"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="border border-border bg-bg-elevated px-6 py-8 sm:px-8">
      <form onSubmit={sendMagicLink} className="space-y-4">
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

        {status === "error" && (
          <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
            {message}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={status === "sending"}
        >
          {status === "sending" ? "Sending…" : "Email me a sign-in link"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-[0.12em] text-text-subtle">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <button
        onClick={signInWithGoogle}
        className="flex h-14 w-full items-center justify-center gap-3 rounded-none border border-border-strong bg-bg px-8 text-sm font-semibold uppercase tracking-[0.12em] text-text transition-colors hover:border-accent active:scale-[0.98]"
      >
        <GoogleGlyph />
        Continue with Google
      </button>

      <p className="mt-6 text-center text-xs text-text-subtle">
        Signing in links you to your existing player stats automatically.
      </p>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.92v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.92a9 9 0 0 0 0 8.1l3.06-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .92 4.95l3.06 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
