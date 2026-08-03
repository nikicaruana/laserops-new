"use client";

/**
 * components/portal/GameSignupControl.tsx
 * --------------------------------------------------------------------
 * Player sign-up control for one game. Flow:
 *   1. Sign up to the match (single action; no payment choice yet).
 *   2. Once an admin CONFIRMS the match, payment opens — the player picks
 *      pay-online or pay-on-the-day. Online payers can also BOOK a gun in
 *      advance (stored on the signup; pre-selects at live join).
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
  // Payment is only addressed once the match is confirmed (past tentative).
  const paymentOpen = status === "confirmed" || status === "live";

  async function signUp() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    // No payment_intent yet — chosen after the match is confirmed.
    const { error: err } = await supabase
      .from("match_signups")
      .upsert(
        { match_id: matchId, account_id: accountId, status: "registered" },
        { onConflict: "match_id,account_id" },
      );
    setBusy(false);
    if (err) return setError(err.message);
    router.refresh();
  }

  async function patch(fields: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("match_signups")
      .update(fields)
      .eq("match_id", matchId)
      .eq("account_id", accountId);
    setBusy(false);
    if (err) return setError(err.message);
    return true;
  }

  async function setIntent(intent: "online" | "on_day") {
    if (await patch({ payment_intent: intent })) router.refresh();
  }
  async function saveGun() {
    if (await patch({ booked_gun: pendingGun || null })) {
      setBooking(false);
      router.refresh();
    }
  }
  async function cancel() {
    if (!window.confirm("Cancel your signup for this game?")) return;
    if (await patch({ status: "cancelled" })) router.refresh();
  }

  // ---- Signed up ----------------------------------------------------------
  if (signedUp) {
    const chosen = mySignup?.payment_intent === "online" || mySignup?.payment_intent === "on_day";
    const onDay = mySignup?.payment_intent === "on_day";
    const canBook = mySignup?.payment_intent === "online" && guns.length > 0;
    const bookedLabel = guns.find((g) => g.name === mySignup?.booked_gun)?.label ?? mySignup?.booked_gun;

    return (
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <span className="inline-flex items-center gap-2 border border-accent bg-accent/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-accent">
          ✓ You&apos;re in
          {paymentOpen && chosen ? (mySignup?.paid_at ? " · paid" : onDay ? " · paying on day" : " · paying online") : ""}
        </span>

        {/* Payment only opens after the match is confirmed */}
        {!paymentOpen ? (
          <span className="text-[0.7rem] text-text-subtle">Payment opens once the game&apos;s confirmed.</span>
        ) : !chosen ? (
          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-text-muted">
              How will you pay?
            </span>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setIntent("online")} disabled={busy} className="border border-accent bg-accent px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.1em] text-bg disabled:opacity-50">
                Pay online
              </button>
              <button type="button" onClick={() => setIntent("on_day")} disabled={busy} className="border border-border-strong px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.1em] text-text-muted hover:border-accent hover:text-accent disabled:opacity-50">
                Pay on the day
              </button>
            </div>
          </div>
        ) : (
          <>
            {canBook && (
              <div className="w-64 max-w-full sm:text-right">
                {booking ? (
                  <div className="text-left">
                    <p className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted">Book your gun</p>
                    <GunCarousel guns={guns} value={pendingGun} onChange={setPendingGun} />
                    <div className="mt-1 flex items-center gap-3 text-[0.7rem]">
                      <button type="button" onClick={saveGun} disabled={busy} className="font-bold uppercase tracking-[0.1em] text-accent disabled:opacity-50">Save gun</button>
                      <button type="button" onClick={() => setBooking(false)} className="font-semibold uppercase tracking-[0.1em] text-text-subtle hover:text-text">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setBooking(true)} className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-text-muted hover:text-accent">
                    {bookedLabel ? <>Gun booked: <span className="text-accent">{bookedLabel}</span> · change</> : "Book your gun →"}
                  </button>
                )}
              </div>
            )}
            {!mySignup?.paid_at && (
              <button type="button" onClick={() => setIntent(onDay ? "online" : "on_day")} disabled={busy} className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-text-muted hover:text-accent disabled:opacity-50">
                {onDay ? "Switch to pay online" : "Switch to pay on the day"}
              </button>
            )}
          </>
        )}

        <button type="button" onClick={cancel} disabled={busy} className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-text-subtle hover:text-red-400 disabled:opacity-50">
          Cancel signup
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    );
  }

  // ---- Not signed up ------------------------------------------------------
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
      <button
        type="button"
        onClick={signUp}
        disabled={busy}
        className="border border-accent bg-accent px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? "Signing up…" : "Sign up to this match"}
      </button>
      <p className="text-[0.65rem] text-text-subtle">Payment is sorted once the game&apos;s confirmed.</p>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
