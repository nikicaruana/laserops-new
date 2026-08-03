"use client";

/**
 * components/portal/GameSignupControl.tsx
 * --------------------------------------------------------------------
 * Player sign-up control for one open game. Sign up choosing pay-online or
 * pay-on-the-day, switch payment method, or cancel. Online payers can also
 * BOOK a gun in advance (stored on the signup; it pre-selects at live join).
 * Writes match_signups via the player's own session (RLS: own rows, open
 * matches). Online payment itself is a later phase — 'online' records intent.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GunCarousel, type CarouselGun } from "@/components/portal/GunCarousel";

type MySignup = {
  payment_intent: string | null;
  status: string | null;
  paid_at: string | null;
  booked_gun?: string | null;
} | null;

export function GameSignupControl({
  matchId,
  accountId,
  status,
  isFull,
  mySignup,
  guns = [],
}: {
  matchId: string;
  accountId: string;
  status: string | null;
  isFull: boolean;
  mySignup: MySignup;
  guns?: CarouselGun[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [pendingGun, setPendingGun] = useState(mySignup?.booked_gun ?? guns[0]?.name ?? "");

  const open = status === "tentative" || status === "awaiting_confirm" || status === "confirmed";
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
    if (err) return setError(err.message);
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
    if (err) return setError(err.message);
    router.refresh();
  }

  async function saveGun() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("match_signups")
      .update({ booked_gun: pendingGun || null })
      .eq("match_id", matchId)
      .eq("account_id", accountId);
    setBusy(false);
    if (err) return setError(err.message);
    setBooking(false);
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
    if (err) return setError(err.message);
    router.refresh();
  }

  if (signedUp) {
    const onDay = mySignup?.payment_intent === "on_day";
    const canBook = !onDay && guns.length > 0;
    const bookedLabel = guns.find((g) => g.name === mySignup?.booked_gun)?.label ?? mySignup?.booked_gun;
    return (
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <span className="inline-flex items-center gap-2 border border-accent bg-accent/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-accent">
          ✓ You&apos;re in{mySignup?.paid_at ? " · paid" : onDay ? " · paying on day" : " · paying online"}
        </span>

        {canBook && (
          <div className="w-64 max-w-full sm:text-right">
            {booking ? (
              <div className="text-left">
                <p className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted">
                  Book your gun
                </p>
                <GunCarousel guns={guns} value={pendingGun} onChange={setPendingGun} />
                <div className="mt-1 flex items-center gap-3 text-[0.7rem]">
                  <button type="button" onClick={saveGun} disabled={busy} className="font-bold uppercase tracking-[0.1em] text-accent disabled:opacity-50">
                    Save gun
                  </button>
                  <button type="button" onClick={() => setBooking(false)} className="font-semibold uppercase tracking-[0.1em] text-text-subtle hover:text-text">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setBooking(true)}
                className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-text-muted hover:text-accent"
              >
                {bookedLabel ? <>Gun booked: <span className="text-accent">{bookedLabel}</span> · change</> : "Book your gun →"}
              </button>
            )}
          </div>
        )}

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
        {status === "live" ? "Game in progress" : "Signups closed"}
      </span>
    );
  }

  if (isFull) {
    return <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle">Full</span>;
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
      {guns.length > 0 && (
        <p className="text-[0.65rem] text-text-subtle">Pay online to book your gun in advance.</p>
      )}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
