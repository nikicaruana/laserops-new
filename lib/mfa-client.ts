/**
 * lib/mfa-client.ts
 * --------------------------------------------------------------------
 * Small browser-side helpers shared by the admin 2FA surfaces (entry gate, idle
 * lock, step-up prompt). Both TOTP (authenticator code) and WebAuthn (biometric
 * / passkey - Face ID, Touch ID, Windows Hello, Android fingerprint) are MFA
 * factors in Supabase; a verified factor of either kind elevates the session to
 * aal2, which is what the admin gating checks. These helpers just tell a surface
 * which factor kinds the admin has, and run a biometric verification.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** True when this browser can do WebAuthn at all (no biometric UI otherwise). */
export function webauthnSupported(): boolean {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential !== "undefined";
}

/** The admin's first verified TOTP and WebAuthn factor ids (null if none). */
export async function verifiedFactorIds(
  supabase: SupabaseClient,
): Promise<{ totpId: string | null; webauthnId: string | null }> {
  const { data } = await supabase.auth.mfa.listFactors();
  const all = data?.all ?? [];
  const verified = (type: string) =>
    all.find((f) => f.factor_type === type && f.status === "verified")?.id ?? null;
  return { totpId: verified("totp"), webauthnId: verified("webauthn") };
}

/**
 * Run a biometric (WebAuthn) verification for an existing factor. Resolves to an
 * error string on failure, or null on success (session is now aal2). The user
 * cancelling the OS prompt is treated as a soft error (not shown as a failure).
 */
export async function authenticateWithBiometrics(
  supabase: SupabaseClient,
  factorId: string,
): Promise<string | null> {
  try {
    const { error } = await supabase.auth.mfa.webauthn.authenticate({ factorId });
    if (error) {
      const msg = String(error.message || "");
      // User dismissed the OS prompt / aborted the ceremony - let them retry quietly.
      if (/abort|cancel|NotAllowed|timed? ?out/i.test(msg)) return "cancelled";
      return msg || "Biometric sign-in failed.";
    }
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/abort|cancel|NotAllowed|timed? ?out/i.test(msg)) return "cancelled";
    return msg || "Biometric sign-in failed.";
  }
}
