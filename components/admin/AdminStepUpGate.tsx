"use client";

/**
 * components/admin/AdminStepUpGate.tsx
 * --------------------------------------------------------------------
 * Requires a 2FA-elevated (aal2) session to use the admin panel at all. The
 * admin layout renders this whenever the current session is not aal2; it covers
 * the whole admin area with an opaque overlay until the admin enters a current
 * authenticator code (which elevates the session to aal2).
 *
 * Edge case - an admin with no TOTP factor yet: they can't step up, so we let
 * them reach /admin/security to enrol (that page is exempt) and prompt them to.
 */
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { verifiedFactorIds, authenticateWithBiometrics, webauthnSupported } from "@/lib/mfa-client";

export function AdminStepUpGate({ canStepUp }: { canStepUp: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [webauthnId, setWebauthnId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onEnrolPage = pathname?.startsWith("/admin/security");
  const canBiometric = !!webauthnId && webauthnSupported();

  useEffect(() => {
    if (!canStepUp) return;
    const supabase = createClient();
    verifiedFactorIds(supabase).then(({ totpId, webauthnId }) => {
      setFactorId(totpId);
      setWebauthnId(webauthnId);
    });
  }, [canStepUp]);

  async function doBiometrics() {
    if (!webauthnId) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const err = await authenticateWithBiometrics(supabase, webauthnId);
    setBusy(false);
    if (err) {
      if (err !== "cancelled") setError(err);
      return;
    }
    setVerified(true);
    router.refresh();
  }

  // Lock scroll while the gate is up.
  useEffect(() => {
    if (verified || (!canStepUp && onEnrolPage)) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [verified, canStepUp, onEnrolPage]);

  function signOut() {
    const supabase = createClient();
    supabase.auth.signOut().finally(() => window.location.assign("/player-portal/login?next=/admin"));
  }

  async function submit(e: React.FormEvent) {
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
    setVerified(true); // hide immediately, then re-sync the server layout
    router.refresh();
  }

  // Once verified this turn, get out of the way (server layout re-renders aal2).
  if (verified) return null;
  // No factor + already on the enrol page: let them set up 2FA unobstructed.
  if (!canStepUp && onEnrolPage) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm border border-border-strong bg-bg-elevated p-6 text-center">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-text-subtle">LaserOps Admin</p>
        <h3 className="mt-2 text-lg font-bold uppercase tracking-[0.08em] text-accent">Two-factor required</h3>

        {canStepUp ? (
          <>
            <p className="mt-2 text-xs text-text-muted">
              {canBiometric
                ? "Use biometrics, or enter the code from your authenticator app, to open the admin panel."
                : "Enter the 6-digit code from your authenticator app to open the admin panel."}
            </p>

            {canBiometric && (
              <button
                type="button"
                onClick={doBiometrics}
                disabled={busy}
                className="mt-4 h-11 w-full border border-accent bg-accent text-sm font-bold uppercase tracking-[0.12em] text-bg hover:bg-accent-soft disabled:opacity-50"
              >
                {busy ? "…" : "Unlock with biometrics"}
              </button>
            )}

            {factorId && (
              <form onSubmit={submit}>
                {canBiometric && (
                  <p className="mt-4 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-text-subtle">or enter a code</p>
                )}
                <input
                  autoFocus={!canBiometric}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="mt-3 h-12 w-full rounded-none border border-border-strong bg-bg px-3 text-center font-mono text-lg tracking-[0.4em] text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className={`mt-4 h-11 w-full text-sm font-bold uppercase tracking-[0.12em] disabled:opacity-50 ${canBiometric ? "border border-border-strong text-text hover:border-accent hover:text-accent" : "border border-accent bg-accent text-bg hover:bg-accent-soft"}`}
                >
                  {busy ? "Verifying…" : "Enter admin"}
                </button>
              </form>
            )}

            {error && (
              <p className="mt-3 border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-400">{error}</p>
            )}
          </>
        ) : (
          <>
            <p className="mt-2 text-xs text-text-muted">
              The admin panel needs two-factor authentication. Set it up to continue - you&apos;ll only
              do this once.
            </p>
            <Link
              href="/admin/security"
              className="mt-4 flex h-11 w-full items-center justify-center border border-accent bg-accent text-sm font-bold uppercase tracking-[0.12em] text-bg hover:bg-accent-soft"
            >
              Set up 2FA
            </Link>
          </>
        )}

        <button
          type="button"
          onClick={signOut}
          className="mt-4 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-text-subtle hover:text-accent"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
