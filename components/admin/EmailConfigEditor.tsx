"use client";

/**
 * components/admin/EmailConfigEditor.tsx
 * --------------------------------------------------------------------
 * Edits the email_config key/value rows (logo, socials, links, sender identity,
 * URL templates). These fill email templates site-wide (each key is a token like
 * {{logoUrl}}) and set the sender / reply-to on notification emails. Admins can
 * add new tokens and remove ones they don't need. Saves via upsert + delete
 * (admin RLS).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { senderDomainError } from "@/lib/email-domains";

const input = "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text focus:border-accent focus:outline-none";

export function EmailConfigEditor({ initial }: { initial: { key: string; value: string }[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [removed, setRemoved] = useState<string[]>([]);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setVal = (key: string, value: string) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, value } : r)));
    setSaved(false);
  };

  function addToken() {
    const key = newKey.trim();
    if (!key) return;
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) {
      setError("Token names must start with a letter and use only letters, numbers and underscores.");
      return;
    }
    if (rows.some((r) => r.key === key)) {
      setError("That token already exists.");
      return;
    }
    setError(null);
    setRows((prev) => [...prev, { key, value: newValue }]);
    setRemoved((prev) => prev.filter((k) => k !== key));
    setNewKey("");
    setNewValue("");
    setSaved(false);
  }

  function removeToken(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
    setRemoved((prev) => [...prev, key]);
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const fromErr = senderDomainError(rows.find((r) => r.key === "fromEmail")?.value);
    if (fromErr) { setBusy(false); setError(fromErr); return; }
    const supabase = createClient();
    const toDelete = removed.filter((k) => !rows.some((r) => r.key === k));
    if (toDelete.length) {
      const { error: delErr } = await supabase.from("email_config").delete().in("key", toDelete);
      if (delErr) {
        setBusy(false);
        return setError(delErr.message);
      }
    }
    const { error: err } = await supabase.from("email_config").upsert(rows.map((r) => ({ key: r.key, value: r.value })), { onConflict: "key" });
    setBusy(false);
    if (err) return setError(err.message);
    setRemoved([]);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="max-w-3xl space-y-5">
      {error && <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>}

      <div className="border border-border bg-bg-elevated px-5 py-5">
        <div className="grid gap-4">
          {rows.map((r) => (
            <div key={r.key}>
              <label className="mb-1.5 block font-mono text-[0.65rem] font-semibold tracking-[0.04em] text-text-muted">{r.key}</label>
              <div className="flex items-center gap-2">
                <input className={input} value={r.value} onChange={(e) => setVal(r.key, e.target.value)} spellCheck={false} />
                <button
                  type="button"
                  onClick={() => removeToken(r.key)}
                  aria-label={`Remove ${r.key}`}
                  className="shrink-0 border border-border-strong px-3 py-2.5 text-xs font-bold text-text-subtle hover:border-red-700 hover:text-red-400"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-dashed border-border px-5 py-5">
        <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted">Add a token</p>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
          <input className={input} value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="tokenName" spellCheck={false} />
          <input className={input} value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Value" spellCheck={false} />
          <Button type="button" size="md" variant="secondary" onClick={addToken}>Add</Button>
        </div>
        <p className="mt-2 text-[0.65rem] text-text-subtle">Use it in any email template as <code className="text-text-muted">{"{{tokenName}}"}</code>. Save to apply.</p>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" size="md" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save email settings"}</Button>
        {saved && <span className="text-xs text-accent">Saved.</span>}
      </div>
    </div>
  );
}
