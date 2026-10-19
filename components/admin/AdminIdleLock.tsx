"use client";

/**
 * components/admin/AdminIdleLock.tsx
 * --------------------------------------------------------------------
 * After a period of inactivity in the admin panel, locks the screen behind a
 * 2FA step-up instead of signing the admin out. The session stays alive (so no
 * full re-login / lost work), but a walked-away device can't be used on the
 * admin panel until someone enters the current authenticator code. Any real
 * interaction resets the idle timer; a lightweight interval checks elapsed idle
 * time (no timer churn on every mousemove). Mounted in the admin layout only.
 *
 * If the admin has no TOTP factor enrolled we can't 2FA-gate, so we fall back to
 * the old behaviour and sign them out. Admins are expected to have 2FA (publish
 * / recompute / lifecycle actions already require it).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const IDLE_MS = 15 * 60 * 1000; // 15 minutes of inactivity before the lock.

export function AdminIdleLock() {
  const [locked, setLocked] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastRef = useRef(Date.now());

  const signOut = useCallback(() => {
    const supabase = createClient();
    supabase.auth.signOut().finally(() => {
      window.location.assign("/player-portal/login?next=/admin&timeout=1");
    });
  }, []);

  // Idle detection. Pauses while already locked.
  useEffect(() => {
    if (locked) return;
    lastRef.current = Date.now();
    const reset = () => {
      lastRef.current = Date.now();
    };
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));

    const interval = setInterval(async () => {
      if (Date.now() - lastRef.current < IDLE_MS) return;
      clearInterval(interval);
      // Lock behind 2FA if a factor exists; otherwise sign out (can't gate).
      const supabase = createClient();
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = (data?.totp ?? []).find((f) => f.status === "verified");
      if (!verified) {
        signOut();
        return;
      }
      setFactorId(verified.id);
      setCode("");
      setError(null);
      setLocked(true);
    }, 30_000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      clearInterval(interval);
    };
  }, [locked, signOut]);

  // Prevent the page behind the lock from scrolling while locked.
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    if (code.trim().length < 6) return setError("Enter the 6-digit code.");
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (err) {
      setBusy(false);
      setCode("");
      setError("Incorrect or expired code.");
      return;
    }
    setBusy(false);
    setCode("");
    setLocked(false); // Resume; the idle effect re-arms and resets the timer.
  }

  if (!locked) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm border border-border-strong bg-bg-elevated p-6 text-center">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-text-subtle">LaserOps Admin</p>
        <h3 className="mt-2 text-lg font-bold uppercase tracking-[0.08em] text-accent">Session locked</h3>
        <p className="mt-2 text-xs text-text-muted">
          You were idle for a while. Enter the 6-digit code from your authenticator app to carry on.
        </p>
        <form onSubmit={unlock}>
          <input
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="mt-4 h-12 w-full rounded-none border border-border-strong bg-bg px-3 text-center font-mono text-lg tracking-[0.4em] text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
          />
          {error && (
            <p className="mt-3 border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="mt-4 h-11 w-full border border-accent bg-accent text-sm font-bold uppercase tracking-[0.12em] text-bg hover:bg-accent-soft disabled:opacity-50"
          >
            {busy ? "Unlocking…" : "Unlock"}
          </button>
        </form>
        <button
          type="button"
          onClick={signOut}
          className="mt-4 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-text-subtle hover:text-accent"
        >
          Sign out instead
        </button>
      </div>
    </div>
  );
}
