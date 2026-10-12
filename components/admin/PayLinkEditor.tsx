"use client";

/**
 * components/admin/PayLinkEditor.tsx
 * --------------------------------------------------------------------
 * Set the business Revolut link players use to pay their post-game bill. Stored
 * on pricing_config via the admin-gated admin_set_revolut_link RPC.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export function PayLinkEditor({ initial }: { initial: string }) {
  const router = useRouter();
  const [link, setLink] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_set_revolut_link", { p_link: link.trim() });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: "Saved." });
    router.refresh();
  }

  return (
    <section className="border border-border bg-bg-elevated p-5 sm:p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-accent">Revolut payment link</h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">Link</label>
          <input
            className="h-11 w-full rounded-none border border-border-strong bg-bg-elevated px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://revolut.me/yourname"
          />
        </div>
        <Button variant="primary" size="md" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save link"}</Button>
      </div>
      {msg && <p className={`mt-3 text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
      <p className="mt-3 text-xs text-text-subtle">Players open this to pay their post-game bill by Revolut (with a short reference note).</p>
    </section>
  );
}
