"use client";

/**
 * components/admin/SignupPaidToggle.tsx
 * --------------------------------------------------------------------
 * Admin payment controls for one signup:
 *   - Mark paid / Mark unpaid: a bookkeeping correction (no money moves) via
 *     admin_set_signup_paid.
 *   - Refund: actually returns the money via the capturing provider (Viva,
 *     clears the paid flag. Use this to approve a 24-48h cancellation request
 *     (shown as "Refund requested") or any goodwill refund.
 * Refund state is surfaced so requests aren't missed.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignupPaidToggle({
  matchId,
  accountId,
  initialPaid,
  paidAmountEur,
  intent,
  refundStatus,
}: {
  matchId: string;
  accountId: string;
  initialPaid: boolean;
  paidAmountEur: number | null;
  intent: string | null;
  refundStatus: string | null;
}) {
  const router = useRouter();
  const [paid, setPaid] = useState(initialPaid);
  const [refund, setRefund] = useState<string | null>(refundStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("admin_set_signup_paid", { p_match_id: matchId, p_account_id: accountId, p_paid: !paid });
    setBusy(false);
    if (err) return setError(err.message);
    setPaid(!paid);
    router.refresh();
  }

  async function refundNow() {
    if (!window.confirm("Refund this player? If they paid online this returns their payment to their original payment method.")) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, accountId }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    setBusy(false);
    if (!res.ok || !data.ok) return setError(data.error || "Refund failed.");
    setPaid(false);
    setRefund("refunded");
    router.refresh();
  }

  const btn = "text-[0.6rem] font-bold uppercase tracking-[0.1em] disabled:opacity-50";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {paid ? (
          <span className="text-accent">{(paidAmountEur ?? 0) > 0 ? "Paid" : "Paid · free"}</span>
        ) : intent === "on_day" ? (
          <span className="text-amber-300">Due on day</span>
        ) : intent === "online" ? (
          <span className="text-text-subtle">Unpaid</span>
        ) : (
          <span className="text-text-subtle">–</span>
        )}
        {paid ? (
          <>
            {(paidAmountEur ?? 0) > 0 && (
              <button type="button" onClick={refundNow} disabled={busy} className={`${btn} text-text-subtle hover:text-red-400`}>Refund</button>
            )}
            <button type="button" onClick={toggle} disabled={busy} className={`${btn} text-text-subtle hover:text-accent`}>Mark unpaid</button>
          </>
        ) : (
          <button type="button" onClick={toggle} disabled={busy} className={`${btn} text-text-subtle hover:text-accent`}>Mark paid</button>
        )}
      </div>
      {refund && (
        <span className={`text-[0.6rem] font-semibold uppercase tracking-[0.1em] ${refund === "pending" ? "text-amber-300" : "text-text-subtle"}`}>
          {refund === "refunded" ? "Refunded" : refund === "pending" ? "Refund requested" : "No refund (late cancel)"}
        </span>
      )}
      {error && <span className="text-[0.6rem] text-red-400">{error}</span>}
    </div>
  );
}
