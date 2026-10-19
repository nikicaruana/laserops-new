/**
 * app/admin/payments/page.tsx
 * --------------------------------------------------------------------
 * "Payments due" - a cross-game view of who still owes, settle-able in place.
 * Lists every per-player, already-played roster line that is linked to an account
 * and not marked paid (pay-after-game era only; legacy games up to LO-2026-33 are
 * excluded), with the amount owed (game fee less any token, plus drinks). Mark a
 * player paid (Cash / Revolut) right here, or open the Match Manager for more.
 * Admin-only via admin_outstanding_settlements (RLS admin session).
 */
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PaymentsDueManager, type DueRow } from "@/components/admin/PaymentsDueManager";

export const metadata: Metadata = { title: "Payments due" };

export default async function PaymentsDuePage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_outstanding_settlements");
  const rows = (data ?? []) as DueRow[];

  // Current game-token balance per owing player (for the Tokens column).
  const tokenBalances: Record<string, number> = {};
  const accountIds = [...new Set(rows.map((r) => r.account_id).filter(Boolean))];
  if (accountIds.length) {
    const { data: balRows } = await supabase.rpc("admin_token_balances", { p_account_ids: accountIds });
    for (const b of (balRows ?? []) as { account_id: string; balance: number }[]) tokenBalances[b.account_id] = Number(b.balance);
  }

  return (
    <div>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Payments due</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          Players who still owe for a game they played. Mark them paid (Cash / Revolut) right here. A token already applied
          on the pay page is deducted; the figure is what&apos;s left to pay (plus any drinks).
        </p>
      </header>

      {error ? (
        <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error.message}</p>
      ) : (
        <PaymentsDueManager initial={rows} tokenBalances={tokenBalances} />
      )}
    </div>
  );
}
