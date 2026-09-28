"use client";

/**
 * components/portal/CancelSignupButton.tsx
 * --------------------------------------------------------------------
 * Standalone red cancel control for the bottom of the game page. Cancels the
 * player's signup (or leaves the waitlist) via the cancel route, which applies
 * the refund policy for paid players (auto refund >48h, admin-approved 24-48h,
 * none <24h) and tells the player what happened.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelSignupButton({
  matchId,
  waitlisted = false,
  isOrganiser = false,
}: {
  matchId: string;
  waitlisted?: boolean;
  /** Viewer created this game: back-out copy notes it may carry on with a new organiser. */
  isOrganiser?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    const msg = waitlisted
      ? "Leave the waitlist for this game?"
      : isOrganiser
        ? "Back out of this game? If others have signed up, it carries on with a new organiser. If you're the only one, it gets cancelled."
        : "Cancel your signup for this game?";
    if (!window.confirm(msg)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/signups/${matchId}/cancel`, { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; refund?: string; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Couldn't cancel.");
      const msg =
        data.refund === "refunded"
          ? "Cancelled. Your payment has been refunded in full."
          : data.refund === "pending"
            ? "Cancelled. Your refund request has been sent to LaserOps for approval."
            : data.refund === "denied"
              ? "Cancelled. This is within 24 hours of the game, so the payment is non-refundable."
              : null;
      if (msg) window.alert(msg);
      router.refresh();
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Couldn't cancel.");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={cancel}
        disabled={busy}
        className="w-full border border-red-800 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-red-400 transition-colors hover:bg-red-950/40 disabled:opacity-50 sm:w-auto sm:px-6"
      >
        {busy ? "…" : waitlisted ? "Leave the waitlist" : "Cancel signup"}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
