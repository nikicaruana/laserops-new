"use client";

/**
 * components/admin/MatchAdminActions.tsx
 * --------------------------------------------------------------------
 * Lifecycle actions for a match in the admin detail view. Which buttons show
 * depends on the current status:
 *   tentative / awaiting_confirm -> Confirm game, Cancel
 *   confirmed                    -> Start match (generates the 4-digit entry
 *                                   code + goes live), Cancel
 *   live                         -> Complete match
 *   cancelled                    -> Reopen
 * Writes matches.status (+ entry_code / went_live_at / played_on) via the admin
 * session (admin_all RLS). The match ID (LO-YYYY-NN) is stamped on go-live by a
 * DB trigger.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function gen4() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function MatchAdminActions({
  matchId,
  status,
  scheduledAt,
}: {
  matchId: string;
  status: string | null;
  scheduledAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(fields: Record<string, unknown>, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("matches").update(fields).eq("id", matchId);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
  }

  // Confirming goes through an API route so signed-up players get the
  // "payment is open" email.
  async function confirmGame() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/matches/${matchId}/confirm`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setBusy(false);
    if (!res.ok || !data.ok) {
      setError(data.error || "Couldn't confirm the game.");
      return;
    }
    router.refresh();
  }

  const s = status ?? "tentative";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {(s === "tentative" || s === "awaiting_confirm") && (
        <button
          type="button"
          onClick={confirmGame}
          disabled={busy}
          className="border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          Confirm game
        </button>
      )}

      {s === "confirmed" && (
        <button
          type="button"
          onClick={() =>
            patch(
              { status: "live", entry_code: gen4(), went_live_at: new Date().toISOString() },
              "Start this match now? It goes live and gets a join code for players.",
            )
          }
          disabled={busy}
          className="border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          Start match
        </button>
      )}

      {s === "live" && (
        <button
          type="button"
          onClick={() =>
            patch(
              { status: "completed", played_on: (scheduledAt ?? new Date().toISOString()).slice(0, 10) },
              "Mark this match completed? Players can no longer join.",
            )
          }
          disabled={busy}
          className="border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          Complete match
        </button>
      )}

      {s !== "completed" && s !== "cancelled" && (
        <button
          type="button"
          onClick={() => patch({ status: "cancelled" }, "Cancel this game? Players who signed up will need to be told.")}
          disabled={busy}
          className="border border-red-800 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-red-400 hover:bg-red-950/40 disabled:opacity-50"
        >
          Cancel game
        </button>
      )}

      {s === "cancelled" && (
        <button
          type="button"
          onClick={() => patch({ status: "tentative" })}
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
