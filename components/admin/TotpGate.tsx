"use client";

/**
 * components/admin/TotpGate.tsx
 * --------------------------------------------------------------------
 * Step-up re-authentication for sensitive admin changes via TOTP (authenticator
 * app). On open it finds the admin's verified TOTP factor and challenges it;
 * the admin enters the 6-digit code, which is verified server-side (Supabase
 * MFA). On success onVerified() runs the actual write. If no factor is enrolled
 * yet, it points the admin to set up 2FA first (can't gate without a factor).
 *
 * A code from the admin's phone can't be produced by someone merely sitting at
 * the device — that's the whole point.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export function TotpGate({
  open,
  action = "this change",
  onCancel,
  onVerified,
}: {
  open: boolean;
  action?: string;
  onCancel: () => void;
  onVerified: () => void | Promise<void>;
}) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCode("");
    setError(null);
    setLoading(true);
    const supabase = createClient();
    supabase.auth.mfa.listFactors().then(({ data, error: err }) => {
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      const verified = (data?.totp ?? []).find((f) => f.status === "verified");
      setFactorId(verified?.id ?? null);
      setLoading(false);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    if (code.trim().length < 6) return setError("Enter the 6-digit code.");
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });
    if (err) {
      setError("Incorrect or expired code.");
      setBusy(false);
      setCode("");
      return;
    }
    setBusy(false);
    setCode("");
    await onVerified();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm border border-border-strong bg-bg-elevated p-6">
        <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-accent">Confirm it&rsquo;s you</h3>

        {loading ? (
          <p className="mt-3 text-xs text-text-subtle">Checking…</p>
        ) : !factorId ? (
          <>
            <p className="mt-2 text-xs text-text-muted">
              Two-factor authentication isn&rsquo;t set up on your account yet. Sensitive changes
              require it.
            </p>
            <div className="mt-5 flex gap-3">
              <Button type="button" variant="secondary" size="md" onClick={onCancel} className="flex-1">
                Cancel
              </Button>
              <Link
                href="/admin/security"
                className="flex flex-1 items-center justify-center border border-accent bg-accent px-4 text-sm font-bold uppercase tracking-[0.12em] text-bg"
              >
                Set up 2FA
              </Link>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <p className="mt-2 text-xs text-text-muted">
              Enter the 6-digit code from your authenticator app to apply {action}.
            </p>
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
            <div className="mt-5 flex gap-3">
              <Button type="button" variant="secondary" size="md" onClick={onCancel} disabled={busy} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" size="md" disabled={busy} className="flex-1">
                {busy ? "Verifying…" : "Confirm"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
