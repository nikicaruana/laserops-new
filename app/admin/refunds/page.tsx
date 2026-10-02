/**
 * app/admin/refunds/page.tsx
 * --------------------------------------------------------------------
 * Refund policy admin: the cancellation refund windows + the player-facing
 * policy text (refund_config). Drives the player cancel route and the policy
 * shown before paying. Admin gating is handled by the /admin layout.
 */
import type { Metadata } from "next";
import { getRefundConfig } from "@/lib/payments/refund-config";
import { RefundConfigEditor } from "@/components/admin/RefundConfigEditor";

export const metadata: Metadata = { title: "Refunds" };

export default async function RefundsAdminPage() {
  const cfg = await getRefundConfig();
  return (
    <div>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Refunds</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          Set when a player cancellation is auto-refunded, by-request, or non-refundable, and the policy text players see
          before they pay. Automatic refunds and the player cancel flow use these windows.
        </p>
      </header>
      <RefundConfigEditor
        autoRefundHours={cfg.autoRefundHours}
        noRefundHours={cfg.noRefundHours}
        policyText={cfg.policyText}
      />
    </div>
  );
}
