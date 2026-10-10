"use client";

/**
 * components/admin/MatchAdminActions.tsx
 * --------------------------------------------------------------------
 * Lifecycle actions for a match in the admin detail view. Which buttons show
 * depends on the current status:
 *   tentative / awaiting_confirm -> Confirm game, Cancel*
 *   confirmed                    -> Start match, Cancel*
 *   live                         -> Complete match*, End early (weather refund)*, Undo go-live
 *                                   (Undo reverts an accidental start back to confirmed; only when
 *                                   no game data exists yet, and it is NOT 2FA-gated as it moves no money.)
 *   cancelled                    -> Reopen
 * ENDING a game - completing it, ending it early, or cancelling it - moves money
 * (refunds) and is irreversible, so each of those (*) requires a 2FA-elevated
 * session: the action opens TotpGate, and only runs once the code is verified.
 * The matching API routes also enforce aal2 server-side. Confirm / Start / Reopen
 * are unchanged (direct writes via admin_all RLS).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TotpGate } from "@/components/admin/TotpGate";

type Gate = { kind: "complete" } | { kind: "cancel" } | { kind: "endEarly"; percent: number };

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
  const [showEndEarly, setShowEndEarly] = useState(false);
  const [gate, setGate] = useState<Gate | null>(null);

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

  async function callRpc(fn: string, confirmMsg: string) {
    if (!window.confirm(confirmMsg)) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc(fn, { p_match_id: matchId });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
  }

  // Starting a match notifies every registered player, so warn loudly when it
  // is not due to start soon (the common accidental-start case). Games also go
  // live automatically 30 min before start.
  function startMatch() {
    const HOUR = 60 * 60 * 1000;
    const startMs = scheduledAt ? new Date(scheduledAt).getTime() : null;
    let msg = "Start this match now? It goes live and gets a join code for players.";
    if (startMs == null) {
      msg =
        "Heads up: this game has no scheduled start time.\n\nSetting it live now will immediately notify all registered players that their game is live. Are you sure you want to go live now?";
    } else if (startMs - Date.now() > HOUR) {
      const mins = Math.round((startMs - Date.now()) / 60000);
      const hrs = Math.round(mins / 60);
      const days = Math.round(mins / 1440);
      const human =
        mins < 60 ? `${mins} min` : mins < 1440 ? `${hrs} hour${hrs === 1 ? "" : "s"}` : `${days} day${days === 1 ? "" : "s"}`;
      const when = new Date(startMs).toLocaleString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      msg = `Heads up: this game is not due to start for another ${human} (starts ${when}).\n\nSetting it live now will immediately notify all registered players that their game is live. Games also go live automatically 30 minutes before start.\n\nAre you sure you want to go live now?`;
    }
    callRpc("admin_start_match", msg);
  }

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

  // The three game-ending actions all run only after 2FA (TotpGate.onVerified).
  async function runGated() {
    if (!gate) return;
    setBusy(true);
    setError(null);
    let url: string;
    let body: string | undefined;
    if (gate.kind === "complete") url = `/api/matches/${matchId}/complete`;
    else if (gate.kind === "cancel") url = `/api/matches/${matchId}/cancel`;
    else {
      url = `/api/matches/${matchId}/end-early`;
      body = JSON.stringify({ percent: gate.percent });
    }
    const res = await fetch(url, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body,
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setBusy(false);
    setGate(null);
    if (!res.ok || !data.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    setShowEndEarly(false);
    router.refresh();
  }

  const gateAction =
    gate?.kind === "complete"
      ? "complete this game"
      : gate?.kind === "cancel"
        ? "cancel this game"
        : gate
          ? `end this game early and refund everyone ${gate.percent}%`
          : "this change";

  // Refund advisory shown in the confirmation popup for the money-moving actions.
  const gateNotice =
    gate?.kind === "cancel"
      ? "Every player who paid will be automatically refunded in full - their card payment reversed and any game tokens returned. Players on a free or zero-price place aren't affected."
      : gate?.kind === "endEarly"
        ? `Every player who paid will be automatically refunded ${gate.percent}% of what they paid (cash and any game tokens).`
        : undefined;

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
          onClick={startMatch}
          disabled={busy}
          className="border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          Start match
        </button>
      )}

      {s === "live" && (
        <>
          <button
            type="button"
            onClick={() => setGate({ kind: "complete" })}
            disabled={busy}
            className="border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            Complete match
          </button>

          {!showEndEarly ? (
            <button
              type="button"
              onClick={() => setShowEndEarly(true)}
              disabled={busy}
              className="border border-amber-700 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-400 hover:bg-amber-950/30 disabled:opacity-50"
            >
              End early (weather)
            </button>
          ) : (
            <span className="flex items-center gap-2 border border-amber-800/60 bg-amber-950/20 px-3 py-1.5">
              <span className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-amber-300">Refund each player</span>
              {[25, 50, 75].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setGate({ kind: "endEarly", percent: p })}
                  disabled={busy}
                  className="border border-amber-600 px-2.5 py-1 text-xs font-bold text-amber-200 hover:bg-amber-600 hover:text-bg disabled:opacity-50"
                >
                  {p}%
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowEndEarly(false)}
                disabled={busy}
                className="px-2 py-1 text-xs font-bold uppercase tracking-[0.1em] text-text-muted hover:text-text disabled:opacity-50"
              >
                Cancel
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={() =>
              callRpc(
                "admin_undo_go_live",
                "This match isn't actually being played? Revert it to Confirmed and clear the join code. Players already notified won't be un-notified.",
              )
            }
            disabled={busy}
            className="border border-border-strong px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-text-muted hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Undo go-live
          </button>
        </>
      )}

      {s !== "completed" && s !== "cancelled" && s !== "live" && (
        <button
          type="button"
          onClick={() => setGate({ kind: "cancel" })}
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

      <TotpGate
        open={gate !== null}
        action={gateAction}
        notice={gateNotice}
        onCancel={() => setGate(null)}
        onVerified={runGated}
      />
    </div>
  );
}
