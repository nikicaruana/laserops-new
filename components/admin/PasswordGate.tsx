"use client";

/**
 * components/admin/PasswordGate.tsx
 * --------------------------------------------------------------------
 * Re-authentication modal for sensitive admin changes. When `open`, prompts
 * the admin to re-enter their password; on a correct password (verified server-
 * side) it calls onVerified() to perform the actual write.
 *
 * Anti-autofill: Chrome ignores autoComplete="off" for password fields, so we
 * use the readonly-until-focus trick — the field is readOnly on mount (the
 * browser's autofill pass skips readOnly fields), and only becomes editable
 * once the admin actually clicks it. Combined with a randomised field name +
 * a decoy username, the field stays genuinely empty until typed into.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

export function PasswordGate({
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
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(true);
  const [fieldName, setFieldName] = useState("reauth-field");

  useEffect(() => {
    if (open) {
      setPassword("");
      setError(null);
      setReadOnly(true);
      setFieldName(`reauth-${Math.random().toString(36).slice(2)}`);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return setError("Enter your password.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error || "Verification failed.");
        setBusy(false);
        return;
      }
      setPassword("");
      await onVerified();
    } catch {
      setError("Verification failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={submit}
        autoComplete="off"
        className="w-full max-w-sm border border-border-strong bg-bg-elevated p-6"
      >
        <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-accent">Confirm it&rsquo;s you</h3>
        <p className="mt-2 text-xs text-text-muted">Re-enter your password to apply {action}.</p>

        {/* Decoy field absorbs any autofill so the real one stays clean. */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />

        {/* type=text + text-security: masks the value but isn't recognised as a
            password field, so Chrome/managers never offer a saved-password fill. */}
        <input
          type="text"
          name={fieldName}
          value={password}
          readOnly={readOnly}
          onFocus={() => setReadOnly(false)}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          data-form-type="other"
          style={{ WebkitTextSecurity: "disc" } as React.CSSProperties}
          className="mt-4 h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
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
    </div>
  );
}
