"use client";

/**
 * components/admin/RestoreFormulaButton.tsx
 * --------------------------------------------------------------------
 * Re-applies an older scoring-formula version as the current formula (going
 * forward). Does NOT undo scoring already done — that's "recompute from date X".
 * Two-step confirm; writes via the admin session (logged as a new change).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const OPERATOR_ID = "00000000-0000-0000-0000-000000000001";

export function RestoreFormulaButton({ structure }: { structure: unknown }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("score_formula")
      .upsert({ operator_id: OPERATOR_ID, structure }, { onConflict: "operator_id" });
    setBusy(false);
    if (err) {
      setError(err.message || "Couldn't restore.");
      return;
    }
    router.push("/admin/scoring");
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="border border-border-strong px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-muted hover:border-accent hover:text-accent"
      >
        Restore
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={restore}
        disabled={busy}
        className="border border-accent bg-accent px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-bg disabled:opacity-50"
      >
        {busy ? "Restoring…" : "Confirm"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={busy}
        className="px-2 py-1.5 text-xs uppercase tracking-[0.1em] text-text-subtle hover:text-text"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
