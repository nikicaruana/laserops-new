"use client";

/**
 * components/admin/TotpEnroll.tsx
 * --------------------------------------------------------------------
 * Manage the admin's own two-factor authentication (TOTP). Enroll an
 * authenticator app (scan the QR or type the secret, then confirm a code) and
 * remove factors. Uses Supabase Auth MFA — no DB work; factors live in auth.
 */
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

type Factor = { id: string; friendly_name: string | null; status: string };
type Enrolling = { factorId: string; qr: string; secret: string };

export function TotpEnroll() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<Enrolling | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const refresh = useCallback(async () => {
    const { data, error: err } = await supabase.auth.mfa.listFactors();
    if (err) {
      setError(err.message);
    } else {
      setFactors((data?.totp ?? []) as Factor[]);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function startEnroll() {
    setError(null);
    setBusy(true);
    const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (err || !data) {
      setError(err?.message || "Couldn't start enrollment.");
      return;
    }
    setCode("");
    setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enrolling) return;
    if (code.trim().length < 6) return setError("Enter the 6-digit code.");
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrolling.factorId,
      code: code.trim(),
    });
    setBusy(false);
    if (err) {
      setError("Incorrect or expired code. Try the next one from your app.");
      setCode("");
      return;
    }
    setEnrolling(null);
    setCode("");
    await refresh();
  }

  async function cancelEnroll() {
    if (enrolling) await supabase.auth.mfa.unenroll({ factorId: enrolling.factorId }).catch(() => {});
    setEnrolling(null);
    setCode("");
    setError(null);
  }

  async function remove(factorId: string) {
    setBusy(true);
    const { error: err } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (err) return setError(err.message);
    await refresh();
  }

  return (
    <div className="max-w-lg space-y-6">
      {error && (
        <p className="border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-400">{error}</p>
      )}

      <section className="border border-border bg-bg-elevated px-5 py-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.12em] text-accent">
          Authenticator apps
        </h2>
        {loading ? (
          <p className="text-xs text-text-subtle">Loading…</p>
        ) : factors.length === 0 ? (
          <p className="text-xs text-text-muted">None yet. Add one to secure sensitive admin changes.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {factors.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-4 border border-border-strong bg-bg px-3 py-2">
                <span className="text-sm text-text">
                  {f.friendly_name || "Authenticator"}
                  <span className="ml-2 text-[0.55rem] uppercase tracking-[0.14em] text-text-subtle">{f.status}</span>
                </span>
                <button
                  type="button"
                  onClick={() => remove(f.id)}
                  disabled={busy}
                  className="border border-red-900/60 px-3 py-1 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-red-400 hover:bg-red-950/40 disabled:opacity-30"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {!enrolling && (
          <div className="mt-4">
            <Button type="button" size="md" onClick={startEnroll} disabled={busy}>
              {busy ? "…" : "Add authenticator"}
            </Button>
          </div>
        )}
      </section>

      {enrolling && (
        <section className="border border-accent/50 bg-bg-elevated px-5 py-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.12em] text-accent">Set up authenticator</h2>
          <ol className="mb-4 list-decimal space-y-1 pl-4 text-xs text-text-muted">
            <li>Open your authenticator app (Google Authenticator, Authy, 1Password…).</li>
            <li>Scan this QR code, or enter the key manually.</li>
            <li>Type the 6-digit code it shows to confirm.</li>
          </ol>
          <div className="flex flex-wrap items-center gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enrolling.qr} alt="TOTP QR code" className="h-40 w-40 bg-white p-1" />
            <div className="min-w-0">
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-text-subtle">Manual key</p>
              <p className="mt-1 select-all break-all font-mono text-xs text-text">{enrolling.secret}</p>
            </div>
          </div>

          <form onSubmit={confirmEnroll} className="mt-5">
            <input
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="h-12 w-40 rounded-none border border-border-strong bg-bg px-3 text-center font-mono text-lg tracking-[0.3em] text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
            />
            <div className="mt-4 flex gap-3">
              <Button type="submit" size="md" disabled={busy}>
                {busy ? "Verifying…" : "Confirm & enable"}
              </Button>
              <Button type="button" variant="secondary" size="md" onClick={cancelEnroll} disabled={busy}>
                Cancel
              </Button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
