"use client";

/**
 * components/admin/PasskeyEnroll.tsx
 * --------------------------------------------------------------------
 * Manage the admin's biometric / passkey factors (WebAuthn): Face ID, Touch ID,
 * Windows Hello, Android fingerprint, or a hardware key. Registering one runs
 * the browser's WebAuthn ceremony (the OS biometric prompt) and stores a
 * verified MFA factor in Supabase Auth - no DB work. A biometric factor
 * satisfies the same aal2 requirement as an authenticator code, so once enrolled
 * the admin can unlock the panel, resume after idle, and confirm sensitive
 * actions with a fingerprint / face instead of typing a code.
 */
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { webauthnSupported } from "@/lib/mfa-client";

type Factor = { id: string; friendly_name: string | null; status: string; factor_type: string };

export function PasskeyEnroll() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  const supabase = createClient();

  const refresh = useCallback(async () => {
    const { data, error: err } = await supabase.auth.mfa.listFactors();
    if (err) setError(err.message);
    else setFactors(((data?.all ?? []) as Factor[]).filter((f) => f.factor_type === "webauthn"));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSupported(webauthnSupported());
    refresh();
  }, [refresh]);

  async function addPasskey() {
    setError(null);
    setBusy(true);
    try {
      const friendlyName = `Biometric - ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
      const { error: err } = await supabase.auth.mfa.webauthn.register({ friendlyName });
      if (err) {
        const msg = String(err.message || "");
        if (!/abort|cancel|NotAllowed/i.test(msg)) setError(msg || "Couldn't set up biometrics.");
        return;
      }
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (!/abort|cancel|NotAllowed/i.test(msg)) setError(msg || "Couldn't set up biometrics.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(factorId: string) {
    setBusy(true);
    const { error: err } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (err) return setError(err.message);
    await refresh();
  }

  return (
    <section className="max-w-lg border border-border bg-bg-elevated px-5 py-5">
      <h2 className="mb-1 text-sm font-bold uppercase tracking-[0.12em] text-accent">Biometrics &amp; passkeys</h2>
      <p className="mb-3 text-xs text-text-muted">
        Unlock the admin panel with Face ID, Touch ID, Windows Hello, or your phone&apos;s fingerprint
        instead of typing a code. Enrol one on each device you use.
      </p>

      {error && (
        <p className="mb-3 border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-400">{error}</p>
      )}

      {loading ? (
        <p className="text-xs text-text-subtle">Loading…</p>
      ) : factors.length === 0 ? (
        <p className="text-xs text-text-muted">None yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {factors.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-4 border border-border-strong bg-bg px-3 py-2">
              <span className="text-sm text-text">
                {f.friendly_name || "Biometric"}
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

      <div className="mt-4">
        <Button type="button" size="md" onClick={addPasskey} disabled={busy || !supported}>
          {busy ? "…" : "Add biometrics on this device"}
        </Button>
        {!supported && (
          <p className="mt-2 text-[0.65rem] text-text-subtle">This browser doesn&apos;t support biometric sign-in.</p>
        )}
      </div>
    </section>
  );
}
