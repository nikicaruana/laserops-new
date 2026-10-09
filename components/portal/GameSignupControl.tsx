"use client";

/**
 * components/portal/GameSignupControl.tsx
 * --------------------------------------------------------------------
 * Player sign-up control for one game. Flow:
 *   1. Sign up to the match (single action; no payment choice yet).
 *   2. Once an admin CONFIRMS the match, payment opens:
 *      - OPEN games: the player must pay ONLINE to confirm their place (no
 *        pay-on-the-day option).
 *      - PRIVATE bookings: the player may pay online OR offline on request.
 *      Paid players can also BOOK a gun in advance (stored on the signup).
 * Writes match_signups via the player's own session (RLS: own rows, open
 * matches). Online payment itself is a later phase – 'online' records intent.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { type CarouselGun } from "@/components/portal/GunCarousel";
import { GunBookingModal } from "@/components/portal/GunBookingModal";
import { Modal } from "@/components/ui/Modal";
import { AddPhoneModal } from "@/components/portal/AddPhoneModal";
import { formatEur } from "@/lib/money";
import { cldImage } from "@/lib/cld";
// Import the policy constant directly (not the @/lib/payments barrel) so the
// client bundle doesn't pull in the Stripe provider -> lib/stripe -> node:crypto.
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
  /** Per-player price; enables the "Pay online" checkout button when set. */
  priceEur?: number | null;
  /** True when priceEur is this player's fixed family & friends price; shows a note. */
  familyFriends?: boolean;
  /** Hide the built-in cancel/leave buttons (rendered separately at the page bottom). */
  hideCancel?: boolean;
  /** Private booking: allows paying offline on request. Open games are online-only. */
  isPrivate?: boolean;
  /** The viewer created this game: tailor the "back out" copy (game may carry on). */
  isOrganiser?: boolean;
  /** The player's spendable game-token balance (1 token = 1 free game). */
  tokenBalance?: number;
  /** Tokens already applied to THIS game (0 to 1); the online charge covers the rest. */
  tokensApplied?: number;
  /** Cloudinary URL for the LaserOps game-token coin art. */
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
  const [payOpen, setPayOpen] = useState(false);

  const open = status === "tentative" || status === "awaiting_confirm" || status === "confirmed";
  const registered = mySignup?.status === "registered";
  const waitlisted = mySignup?.status === "waitlisted";
  // Payment is only addressed once the match is confirmed (past tentative).
  const paymentOpen = status === "confirmed" || status === "live";

  // Terminal games take no signups or payment — never show the "payment opens"
  // / sign-up prompts once a game is over or cancelled.
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
    // No payment_intent yet – chosen after the match is confirmed.
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
    if (await patch({ payment_intent: intent })) startTransition(() => router.refresh());
  }
  async function cancel() {
    const msg = isOrganiser
      ? "Back out of this game? If others have signed up, it carries on with a new organiser. If you're the only one, it gets cancelled."
      : "Cancel your signup for this game?";
    if (!window.confirm(msg)) return;
    if (await patch({ status: "cancelled" })) startTransition(() => router.refresh());
  }
  async function payNow() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/checkout/${matchId}`, { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !data.ok || !data.url) throw new Error(data.error || "Couldn't start checkout.");
      window.location.href = data.url;
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Couldn't start checkout.");
    }
  }
  async function payWithTokens(amount: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/signups/${matchId}/pay-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, idempotencyKey: crypto.randomUUID() }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Couldn't use your tokens.");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't use your tokens.");
    } finally {
      setBusy(false);
    }
  }
  async function useFullToken() {
    await payWithTokens(1);
    setPayOpen(false);
  }
  async function useFractionThenViva() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/signups/${matchId}/pay-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: tokenBalance, idempotencyKey: crypto.randomUUID() }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not apply your token.");
      await payNow(); // redirect to card checkout for the remainder
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Could not apply your token.");
    }
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
    const onDay = mySignup?.payment_intent === "on_day";
    const isPaid = Boolean(mySignup?.paid_at);
    const hasPrice = priceEur != null && priceEur > 0;
    // Gun booking is a perk unlocked once payment is confirmed (not just chosen).
    const canBook = isPaid && guns.length > 0;
    const bookedLabel = guns.find((g) => g.name === mySignup?.booked_gun)?.label ?? mySignup?.booked_gun;

    const applied = Math.max(0, Math.min(1, tokensApplied));
    const remainderEur = hasPrice ? (priceEur as number) * (1 - applied) : 0;
    const fmtTok = (n: number) => (Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(2))));

    // Game-token payment options (1 token = 1 free game; fractions part-pay).
    const canUseFullToken = hasPrice && applied === 0 && tokenBalance >= 1;
    const canUseFraction = hasPrice && applied === 0 && tokenBalance > 0 && tokenBalance < 1;

    // Single Pay-now button that opens a modal to choose how to pay: a full
    // token (free), part-token + card for the remainder, or card in full.
    const payFlow =
      hasPrice && !isPaid ? (
        <>
          <button
            type="button"
            onClick={() => setPayOpen(true)}
            disabled={pending}
            className="border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {applied > 0 ? `Pay ${formatEur(remainderEur)} remainder` : "Pay now"}
          </button>
          {payOpen && (
            <Modal title="Pay for this game" onClose={() => setPayOpen(false)}>
              <div className="space-y-3 text-left">
                <p className="text-sm text-text-muted">
                  {applied > 0 ? (
                    <>
                      {fmtTok(applied)} token applied &middot;{" "}
                      <span className="font-semibold text-text">{formatEur(remainderEur)}</span> left to pay
                    </>
                  ) : (
                    <>
                      Game price: <span className="font-semibold text-text">{formatEur(priceEur as number)}</span>
                    </>
                  )}
                </p>
                {tokenBalance > 0 && (
                  <div className="flex items-center gap-2 border border-border bg-bg-overlay px-3 py-2">
                    {tokenImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cldImage(tokenImageUrl, { w: 96 })} alt="" className="h-8 w-8 shrink-0 object-contain" />
                    ) : null}
                    <span className="text-xs text-text-muted">
                      Your wallet: <span className="font-mono font-bold text-accent">{fmtTok(tokenBalance)}</span> token{tokenBalance === 1 ? "" : "s"}
                    </span>
                  </div>
                )}
                {canUseFullToken && (
                  <button
                    type="button"
                    onClick={useFullToken}
                    disabled={pending}
                    className="w-full border border-accent bg-accent px-4 py-3 text-sm font-bold uppercase tracking-[0.1em] text-bg transition-transform active:scale-[0.98] disabled:opacity-50"
                  >
                    {pending ? "Working…" : "Use 1 token (free game)"}
                  </button>
                )}
                {canUseFraction && (
                  <button
                    type="button"
                    onClick={useFractionThenViva}
                    disabled={pending}
                    className="w-full border border-accent bg-accent/10 px-4 py-3 text-sm font-bold uppercase tracking-[0.1em] text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
                  >
                    {pending ? "Working…" : `Use ${fmtTok(tokenBalance)} token + pay ${formatEur((priceEur as number) * (1 - tokenBalance))} online`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={payNow}
                  disabled={pending}
                  className={`w-full border px-4 py-3 text-sm font-bold uppercase tracking-[0.1em] transition-colors disabled:opacity-50 ${canUseFullToken ? "border-border-strong bg-bg-overlay text-text hover:border-accent" : "border-accent bg-accent text-bg active:scale-[0.98]"}`}
                >
                  {pending ? "Starting checkout…" : `Pay ${formatEur(remainderEur)} online`}
                </button>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <p className="text-[0.65rem] leading-relaxed text-text-subtle">{refundPolicy}</p>
              </div>
            </Modal>
          )}
        </>
      ) : null;
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
          ✓ You&apos;re in
          {paymentOpen ? (isPaid ? " · paid" : onDay ? (isPrivate ? " · paying offline" : " · paying cash on the day") : "") : ""}
        </span>

        {familyFriends && priceEur != null && priceEur > 0 && !mySignup?.paid_at && paymentOpen && (
          <span className="block max-w-full border-l-2 border-emerald-500/70 bg-emerald-500/10 px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-emerald-300">
            Family &amp; friends price
          </span>
        )}
        {!paymentOpen ? (
          <span className="block max-w-full border-l-2 border-amber-500/70 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-amber-300">
            Payment opens once the game&apos;s confirmed
          </span>
        ) : isPaid ? (
          // Paid: advance gun booking is now unlocked.
          gunBooking
        ) : onDay ? (
          // Paying offline: private = arrange with team; open game = cash on the day.
          <div className={`flex flex-col gap-1.5 ${col}`}>
            <span className="block max-w-full border-l-2 border-amber-500/70 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-amber-300">
              {isPrivate
                ? "Paying offline – arrange with the LaserOps team"
                : `Paying ${hasPrice ? formatEur(priceEur as number) + " " : ""}cash on the day`}
            </span>
            {hasPrice && (
              <button type="button" onClick={() => setIntent("online")} disabled={pending} className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-text-muted hover:text-accent disabled:opacity-50">
                Switch to pay online
              </button>
            )}
          </div>
        ) : !isPrivate ? (
          // OPEN game: pay online/tokens now, or opt to pay cash on the day.
          hasPrice ? (
            <div className={`flex flex-col gap-2 ${col}`}>
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-text-muted">
                Pay to confirm your place
              </span>
              {payFlow}
              <button type="button" onClick={() => setIntent("on_day")} disabled={pending} className="border border-border-strong bg-bg-overlay px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-text transition-colors hover:border-accent hover:text-accent disabled:opacity-50">
                Pay {formatEur(priceEur as number)} cash on the day
              </button>
            </div>
          ) : (
            <span className="block max-w-full border-l-2 border-accent/70 bg-accent/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-accent">
              You&apos;re confirmed – see you on the day
            </span>
          )
        ) : (
          // PRIVATE booking, not yet paid: online now, or request to pay offline.
          <div className={`flex flex-col gap-2 ${col}`}>
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-text-muted">
              How will you pay?
            </span>
            {hasPrice && (
              <>
                {payFlow}
              </>
            )}
            <button type="button" onClick={() => setIntent("on_day")} disabled={pending} className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-text-muted hover:text-accent disabled:opacity-50">
              Request to pay offline
            </button>
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
      <p className="text-[0.65rem] text-text-subtle">Payment is sorted once the game&apos;s confirmed.</p>
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
