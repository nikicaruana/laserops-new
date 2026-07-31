"use client";

/**
 * components/portal/GameSignupControl.tsx
 * --------------------------------------------------------------------
 * Player sign-up control for one open game. Sign up choosing pay-online or
 * pay-on-the-day, switch payment method, or cancel. Writes match_signups via
 * the player's own session (RLS: own rows, open matches only). Online payment
 * itself is a later phase — 'online' just records the intent for now.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type MySignup = { payment_intent: string | null; status: string | null; paid_at: string | null } | null;

export function GameSignupControl({
  matchId,
  accountId,
  status,
  isFull,
  mySignup,
}: {
  matchId: string;
  accountId: string;
  status: string | null;
  isFull: boolean;
  mySignup: MySignup;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = status === "tentative" || status === "awaiting_confirm";
  const signedUp = Boolean(mySignup && mySignup.status !== "cancelled");

  async function signUp(intent: "online" | "on_day") {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("match_signups")
      .upsert(
        { match_id: matchId, account_id: accountId, payment_intent: intent, status: "registered" },
        { onConflict: "match_id,account_id" },
      );
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
  }

  async function setIntent(intent: "online" | "on_day") {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("match_signups")
      .update({ payment_intent: intent })
      .eq("match_id", matchId)
      .eq("account_id", accountId);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
  }

  async function cancel() {
    if (!window.confirm("Cancel your signup for this game?")) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("match_signups")
      .update({ status: "cancelled" })
      .eq("match_id", matchId)
      .eq("account_id", accountId);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
  }

  if (signedUp) {
    const onDay = mySignup?.payment_intent === "on_day";
    return (
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <span className="inline-flex items-center gap-2 border border-accent bg-accent/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-accent">
          ✓ You&apos;re in{mySignup?.paid_at ? " · paid" : onDay ? " · paying on day" : " · paying online"}
        </span>
        <div className="flex items-center gap-3 text-[0.7rem]">
          {!mySignup?.paid_at && (
            <button
              type="button"
              onClick={() => setIntent(onDay ? "online" : "on_day")}
              disabled={busy}
              className="font-semibold uppercase tracking-[0.1em] text-text-muted hover:text-accent disabled:opacity-50"
            >
              {onDay ? "Switch to pay online" : "Switch to pay on the day"}
            </button>
          )}
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="font-semibold uppercase tracking-[0.1em] text-text-subtle hover:text-red-400 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    );
  }

  if (!open) {
    return (
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle">
        {status === "confirmed" ? "Signups closed" : "Not open"}
      </span>
    );
  }

  if (isFull) {
    return (
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle">Full</span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => signUp("online")}
          disabled={busy}
          className="border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          Sign up · pay online
        </button>
        <button
          type="button"
          onClick={() => signUp("on_day")}
          disabled={busy}
          className="border border-border-strong px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-text-muted hover:border-accent hover:text-accent disabled:opacity-50"
        >
          Pay on the day
        </button>
      </div>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
