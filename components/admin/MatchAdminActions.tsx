"use client";

/**
 * components/admin/MatchAdminActions.tsx
 * --------------------------------------------------------------------
 * Lifecycle actions for a match in the admin detail view. Which buttons show
 * depends on the current status:
 *   tentative / awaiting_confirm -> Confirm game, Cancel
 *   confirmed                    -> Start match, Cancel
 *   live                         -> Complete match, End early (weather refund), Undo go-live
 *   cancelled                    -> Reopen
 * EVERY lifecycle action here is 2FA-gated: the button opens TotpGate and the
 * action only runs once the code is verified (the matching API routes / RPCs
 * still enforce their own admin checks server-side). The one top-of-page control
 * that is NOT gated is "Create teams", which is a separate link. Ending a game -
 * completing it, ending it early, or cancelling it - also moves money (refunds)
 * and is irreversible, so those carry an extra refund advisory in the gate.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TotpGate } from "@/components/admin/TotpGate";

type Gate =
  | { kind: "complete" }
  | { kind: "cancel" }
  | { kind: "endEarly" }
  | { kind: "confirm" }
  | { kind: "start"; notice: string }
  | { kind: "undo" }
  | { kind: "reopen" };

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
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [gate, setGate] = useState<Gate | null>(null);

  // Email the .ics calendar invite to the business + any registered players.
  // Not 2FA-gated (it only sends an invite, moves no money). Surfaces the real
  // Resend outcome so a bad key / unverified domain is visible, not swallowed.
  async function sendInvites() {
    setBusy(true);
    setError(null);
    setInviteMsg(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/send-invites`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; sent?: number; error?: string; reason?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || data.reason || "Couldn't send the calendar invite.");
      setInviteMsg(`Calendar invite sent to ${data.sent ?? 0} recipient${data.sent === 1 ? "" : "s"} (business + any registered players).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the calendar invite.");
    }
    setBusy(false);
  }

  // Starting a match notifies every registered player, so warn loudly when it
  // is not due to start soon (the common accidental-start case). Games also go
  // live automatically 30 min before start. The warning rides along as the 2FA
  // gate's notice.
  function startMatch() {
    const HOUR = 60 * 60 * 1000;
    const startMs = scheduledAt ? new Date(scheduledAt).getTime() : null;
    let notice = "This goes live and gets a join code for players, who are all notified immediately.";
    if (startMs == null) {
      notice =
        "This game has no scheduled start time. Going live now immediately notifies all registered players that their game is live.";
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
      notice = `Heads up: this game is not due to start for another ${human} (starts ${when}). Going live now immediately notifies all registered players. Games also go live automatically 30 minutes before start.`;
    }
    setGate({ kind: "start", notice });
  }

  // Every gated action runs here, only after TotpGate verifies the code.
  async function runGated() {
    if (!gate) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    try {
      if (gate.kind === "confirm") {
        const res = await fetch(`/api/matches/${matchId}/confirm`, { method: "POST" });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error || "Couldn't confirm the game.");
      } else if (gate.kind === "start") {
        const { error: err } = await supabase.rpc("admin_start_match", { p_match_id: matchId });
        if (err) throw new Error(err.message);
      } else if (gate.kind === "undo") {
        const { error: err } = await supabase.rpc("admin_undo_go_live", { p_match_id: matchId });
        if (err) throw new Error(err.message);
      } else if (gate.kind === "reopen") {
        const { error: err } = await supabase.from("matches").update({ status: "tentative" }).eq("id", matchId);
        if (err) throw new Error(err.message);
      } else {
        const url =
          gate.kind === "complete"
            ? `/api/matches/${matchId}/complete`
            : gate.kind === "cancel"
              ? `/api/matches/${matchId}/cancel`
              : `/api/matches/${matchId}/end-early`;
        const res = await fetch(url, { method: "POST" });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error || "Something went wrong.");
      }
    } catch (e) {
      setBusy(false);
      setGate(null);
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return;
    }
    setBusy(false);
    setGate(null);
    router.refresh();
  }

  const gateAction =
    gate?.kind === "complete"
      ? "complete this game"
      : gate?.kind === "cancel"
        ? "cancel this game"
        : gate?.kind === "endEarly"
          ? "end this game early"
          : gate?.kind === "confirm"
            ? "confirm this game"
            : gate?.kind === "start"
              ? "start this game"
              : gate?.kind === "undo"
                ? "undo go-live"
                : gate?.kind === "reopen"
                  ? "reopen this game"
                  : "this change";

  // Advisory shown in the 2FA popup. The money-moving actions carry a refund note;
  // start/undo carry their own heads-up.
  const gateNotice =
    gate?.kind === "start"
      ? gate.notice
      : gate?.kind === "undo"
        ? "This match isn't actually being played? Revert it to Confirmed and clear the join code. Players already notified won't be un-notified."
        : gate?.kind === "cancel"
          ? "Nothing is charged until after a game, so a cancelled game has nothing to refund. Everyone signed up is notified that the game is off."
          : gate?.kind === "endEarly"
            ? "The game is marked completed so it can be scored and settled. Players settle up afterwards as usual - knock money off a shortened session when you mark each player paid."
            : undefined;

  const s = status ?? "tentative";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {(s === "tentative" || s === "awaiting_confirm") && (
        <button
          type="button"
          onClick={() => setGate({ kind: "confirm" })}
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

          <button
            type="button"
            onClick={() => setGate({ kind: "endEarly" })}
            disabled={busy}
            className="border border-amber-700 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-400 hover:bg-amber-950/30 disabled:opacity-50"
          >
            End early (weather)
          </button>

          <button
            type="button"
            onClick={() => setGate({ kind: "undo" })}
            disabled={busy}
            className="border border-border-strong px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-text-muted hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Undo go-live
          </button>
        </>
      )}

      {(s === "confirmed" || s === "live") && (
        <button
          type="button"
          onClick={sendInvites}
          disabled={busy}
          title="Email the .ics calendar invite to the business and any registered players"
          className="border border-border-strong px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-text-muted hover:border-accent hover:text-accent disabled:opacity-50"
        >
          Send calendar invite
        </button>
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
          onClick={() => setGate({ kind: "reopen" })}
          disabled={busy}
          className="border border-border-strong px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-text-muted hover:border-accent hover:text-accent disabled:opacity-50"
        >
          Reopen
        </button>
      )}

      {error && <span className="text-xs text-red-400">{error}</span>}
      {inviteMsg && <span className="text-xs text-emerald-300">{inviteMsg}</span>}

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
