"use client";

/**
 * components/portal/GameSignupControl.tsx
 * --------------------------------------------------------------------
 * Player sign-up control for one game (pay-after-game model). Flow:
 *   1. Sign up to the match (single action; no payment, ever, at sign-up).
 *   2. Once an admin CONFIRMS the match, gun booking opens for everyone signed
 *      up (stored on the signup). Nothing is charged here.
 *   3. After the game, the player settles up on the post-game pay page
 *      (token / Revolut / cash) - flat-rate private bookings are settled by the
 *      organiser, so those players have nothing to pay.
 * Writes match_signups via the player's own session (RLS: own rows, open matches).
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { type CarouselGun } from "@/components/portal/GunCarousel";
import { GunBookingModal } from "@/components/portal/GunBookingModal";
import { AddPhoneModal } from "@/components/portal/AddPhoneModal";
// Import the policy constant directly (not the @/lib/payments barrel) so the
// client bundle doesn't pull in a payment provider -> node:crypto.
import { REFUND_POLICY } from "@/lib/payments/policy";

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
  align = "end",
  waitlistPosition = null,
  priceEur = null,
  familyFriends = false,
  hideCancel = false,
  isPrivate = false,
  isOrganiser = false,
  tokenBalance = 0,
  tokensApplied = 0,
  tokenImageUrl = "",
  beginnerLock = null,
  refundPolicy = REFUND_POLICY,
}: {
  matchId: string;
  accountId: string;
  status: string | null;
  isFull: boolean;
  mySignup: MySignup;
  guns?: CarouselGun[];
  /** "end" for right-aligned cards (games list); "center" for the invite card; "start" left-aligned. */
  align?: "end" | "center" | "start";
  /** 1-based spot on the waitlist, when the player is waitlisted. */
  waitlistPosition?: number | null;
  /** Per-player price; when set (open games + per-player private), the player settles after the game. */
  priceEur?: number | null;
  /** True when priceEur is this player's fixed family & friends price; shows a note. */
  familyFriends?: boolean;
  /** Hide the built-in cancel/leave buttons (rendered separately at the page bottom). */
  hideCancel?: boolean;
  /** Private booking (flat-rate when priceEur is null = organiser settles for everyone). */
  isPrivate?: boolean;
  /** The viewer created this game: tailor the "back out" copy (game may carry on). */
  isOrganiser?: boolean;
  /** Retained for call-site compatibility; settlement is handled post-game on the pay page. */
  tokenBalance?: number;
  tokensApplied?: number;
  tokenImageUrl?: string;
  /** Set when THIS viewer is above a beginners game's level cap: blocks sign-up with a notice. */
  beginnerLock?: { yourLevel: number; maxLevel: number } | null;
  refundPolicy?: string;
}) {
  const router = useRouter();
  const col = align === "center" ? "items-center text-center" : align === "start" ? "items-start" : "items-start sm:items-end";
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();
  // Keep controls disabled until the server re-render finishes, not just until
  // the write resolves - otherwise the stale button is clickable during the
  // refresh and feels like it "didn't work" (users re-click several times).
  const pending = busy || isPending;
  const [error, setError] = useState<string | null>(null);
  const [needsPhone, setNeedsPhone] = useState(false);
  const [booking, setBooking] = useState(false);

  const open = status === "tentative" || status === "awaiting_confirm" || status === "confirmed";
  const registered = mySignup?.status === "registered";
  const waitlisted = mySignup?.status === "waitlisted";
  // Gun booking + the "settle after the game" note only apply once confirmed.
  const confirmedOpen = status === "confirmed" || status === "live";

  // Terminal games take no signups — never show the sign-up / confirm prompts
  // once a game is over or cancelled.
  if (status === "completed" || status === "cancelled") {
    const done = status === "completed";
    return (
      <span className={`inline-flex items-center gap-2 border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] ${done ? "border-border-strong bg-bg-elevated text-text-muted" : "border-red-600/50 bg-red-500/10 text-red-300"}`}>
        {registered ? (done ? "✓ You played this game" : "Game cancelled") : done ? "Game over" : "Game cancelled"}
      </span>
    );
  }

  async function signUp() {
    setBusy(true);
    setError(null);
    setNeedsPhone(false);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("match_signups")
      .upsert(
        { match_id: matchId, account_id: accountId, status: "registered" },
        { onConflict: "match_id,account_id" },
      );
    setBusy(false);
    if (err) {
      if (/mobile number/i.test(err.message)) setNeedsPhone(true);
      return setError(err.message);
    }
    startTransition(() => router.refresh());
  }

  async function cancel() {
    const msg = isOrganiser
      ? "Back out of this game? If others have signed up, it carries on with a new organiser. If you're the only one, it gets cancelled."
      : "Cancel your signup for this game?";
    if (!window.confirm(msg)) return;
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
    startTransition(() => router.refresh());
  }

  // ---- On the waitlist ----------------------------------------------------
  if (waitlisted) {
    return (
      <div className={`flex flex-col gap-2 ${col}`}>
        <span className="inline-flex items-center gap-2 border border-amber-600/60 bg-amber-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-amber-300">
          On the waitlist{waitlistPosition ? ` · #${waitlistPosition}` : ""}
        </span>
        <span className="text-[0.7rem] text-text-subtle">
          You&apos;ll be moved in automatically (and emailed) if a spot opens up.
        </span>
        {!hideCancel && (
          <button type="button" onClick={cancel} disabled={pending} className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-text-subtle hover:text-red-400 disabled:opacity-50">
            Leave the waitlist
          </button>
        )}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    );
  }

  // ---- Signed up ----------------------------------------------------------
  if (registered) {
    const isPaid = Boolean(mySignup?.paid_at);
    const hasPrice = priceEur != null && priceEur > 0;
    // Gun booking unlocks once the game is CONFIRMED (no payment gate).
    const canBook = confirmedOpen && guns.length > 0;
    const bookedLabel = guns.find((g) => g.name === mySignup?.booked_gun)?.label ?? mySignup?.booked_gun;

    const gunBooking = canBook && (
      <div>
        <button
          type="button"
          onClick={() => setBooking(true)}
          className="flex max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 border border-accent bg-accent/10 px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-accent transition-colors hover:bg-accent/20"
        >
          {bookedLabel ? <>Gun booked: <span>{bookedLabel}</span> · change</> : "Book your gun →"}
        </button>
        {booking && (
          <GunBookingModal
            matchId={matchId}
            guns={guns}
            currentGun={mySignup?.booked_gun ?? null}
            onClose={() => setBooking(false)}
          />
        )}
      </div>
    );

    return (
      <div className={`flex flex-col gap-2 ${col}`}>
        <span className="inline-flex items-center gap-2 border border-accent bg-accent/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-accent">
          ✓ You&apos;re in{confirmedOpen ? " · confirmed" : ""}
        </span>

        {familyFriends && hasPrice && confirmedOpen && !isPaid && (
          <span className="block max-w-full border-l-2 border-emerald-500/70 bg-emerald-500/10 px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-emerald-300">
            Family &amp; friends price
          </span>
        )}

        {!confirmedOpen ? (
          <span className="block max-w-full border-l-2 border-amber-500/70 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-amber-300">
            Gun booking opens once the game&apos;s confirmed
          </span>
        ) : (
          <div className={`flex flex-col gap-2 ${col}`}>
            {gunBooking}
            {isPaid ? null : hasPrice ? (
              <span className="block max-w-full border-l-2 border-accent/70 bg-accent/10 px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-accent">
                Settle up after the game &ndash; token, Revolut or cash
              </span>
            ) : (
              <span className="block max-w-full border-l-2 border-accent/70 bg-accent/10 px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-accent">
                The organiser settles for everyone &ndash; see you on the day
              </span>
            )}
          </div>
        )}

        {!hideCancel && (
          <button type="button" onClick={cancel} disabled={pending} className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-text-subtle hover:text-red-400 disabled:opacity-50">
            Cancel signup
          </button>
        )}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    );
  }

  // ---- Too high a level for a beginners game ------------------------------
  if (beginnerLock && !registered && !waitlisted) {
    return (
      <div className={`flex flex-col gap-2 ${col}`}>
        <span className="inline-flex items-center gap-2 border border-amber-600/60 bg-amber-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-amber-300">
          Beginners only
        </span>
        <span className="text-[0.7rem] text-text-subtle">
          Your level ({beginnerLock.yourLevel}) is too high for this beginners game (max level {beginnerLock.maxLevel}).
        </span>
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
  return (
    <div className={`flex flex-col gap-2 ${col}`}>
      {isFull && (
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-amber-300">
          Game&apos;s full – you&apos;ll join the waitlist
        </span>
      )}
      <button
        type="button"
        onClick={signUp}
        disabled={pending}
        className="border border-accent bg-accent px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "Signing up…" : isFull ? "Join the waitlist" : "Sign up to this game"}
      </button>
      <p className="text-[0.65rem] text-text-subtle">No payment to sign up &ndash; you settle up after you play.</p>
      {error && <span className="text-xs text-red-400">{error}</span>}
      {needsPhone && (
        <AddPhoneModal
          onClose={() => setNeedsPhone(false)}
          onSaved={() => { setNeedsPhone(false); signUp(); }}
        />
      )}
    </div>
  );
}
