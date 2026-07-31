"use client";

/**
 * components/admin/RestoreFormulaButton.tsx
 * --------------------------------------------------------------------
 * Re-applies an older scoring-formula version as the current formula (going
 * forward). Does NOT undo scoring already done — that's "recompute from date X".
 * Gated behind a password re-auth (sensitive change).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PasswordGate } from "@/components/admin/PasswordGate";

const OPERATOR_ID = "00000000-0000-0000-0000-000000000001";

export function RestoreFormulaButton({
  structure,
  modeSlug,
}: {
  structure: unknown;
  modeSlug: string;
}) {
  const router = useRouter();
  const [gateOpen, setGateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doRestore() {
    setGateOpen(false);
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("score_formula")
      .upsert(
        { operator_id: OPERATOR_ID, mode_slug: modeSlug, structure },
        { onConflict: "operator_id,mode_slug" },
      );
    setBusy(false);
    if (err) {
      setError(err.message || "Couldn't restore.");
      return;
    }
    router.push(`/admin/scoring?mode=${modeSlug}`);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setGateOpen(true)}
        disabled={busy}
        className="border border-border-strong px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-muted hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {busy ? "Restoring…" : "Restore"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
      <PasswordGate
        open={gateOpen}
        action="this rollback"
        onCancel={() => setGateOpen(false)}
        onVerified={doRestore}
      />
    </div>
  );
}
