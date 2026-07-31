"use client";

/**
 * components/admin/MatchAdminActions.tsx
 * --------------------------------------------------------------------
 * Lifecycle actions for a match in the admin detail view. Which buttons show
 * depends on the current status:
 *   tentative / awaiting_confirm -> Confirm game, Cancel
 *   confirmed                    -> Cancel  (Start match / live is Phase 4)
 * Writes matches.status via the admin session (admin_all RLS).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function MatchAdminActions({ matchId, status }: { matchId: string; status: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(next: string, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("matches").update({ status: next }).eq("id", matchId);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
  }

  const s = status ?? "tentative";
  const canConfirm = s === "tentative" || s === "awaiting_confirm";
  const canCancel = s !== "completed" && s !== "cancelled";
  const canReopen = s === "cancelled";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {canConfirm && (
        <button
          type="button"
          onClick={() => setStatus("confirmed")}
          disabled={busy}
          className="border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          Confirm game
        </button>
      )}
      {canCancel && (
        <button
          type="button"
          onClick={() => setStatus("cancelled", "Cancel this game? Players who signed up will need to be told.")}
          disabled={busy}
          className="border border-red-800 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-red-400 hover:bg-red-950/40 disabled:opacity-50"
        >
          Cancel game
        </button>
      )}
      {canReopen && (
        <button
          type="button"
          onClick={() => setStatus("tentative")}
          disabled={busy}
          className="border border-border-strong px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-text-muted hover:border-accent hover:text-accent disabled:opacity-50"
        >
          Reopen
        </button>
      )}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
