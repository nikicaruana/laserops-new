"use client";

/**
 * components/admin/GunDeleteButton.tsx
 * --------------------------------------------------------------------
 * Danger-zone delete for a gun. Requires typing DELETE to confirm, then
 * removes the guns row (gun_damage_history cascades via FK) through the
 * admin's session (guns_admin_write RLS) and returns to the list.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function GunDeleteButton({ gunId, gunName }: { gunId: string; gunName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function del() {
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.from("guns").delete().eq("id", gunId);
    if (err) {
      setError(err.message || "Couldn't delete.");
      setBusy(false);
      return;
    }
    router.push("/admin/guns");
    router.refresh();
  }

  return (
    <section className="mt-10 border border-red-900/60 bg-red-950/10 px-5 py-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-red-400">
        Danger zone
      </h2>
      {!open ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-text-muted">
            Permanently delete <span className="font-semibold text-text">{gunName}</span> and
            its damage history.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="border border-red-800 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-red-400 transition-colors hover:bg-red-950/50"
          >
            Delete gun
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-red-400/90">
            This can&rsquo;t be undone. Type <span className="font-mono font-bold">DELETE</span> to
            confirm.
          </p>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
            className="h-11 w-full max-w-xs rounded-none border border-border-strong bg-bg px-3 text-sm text-text placeholder:text-text-subtle focus:border-red-600 focus:outline-none"
          />
          {error && (
            <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>
          )}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => {
                setOpen(false);
                setText("");
                setError(null);
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <button
              type="button"
              onClick={del}
              disabled={text !== "DELETE" || busy}
              className="h-11 bg-red-700 px-6 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Deleting…" : "Permanently delete"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
