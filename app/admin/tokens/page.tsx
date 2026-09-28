/**
 * app/admin/tokens/page.tsx
 * --------------------------------------------------------------------
 * Admin control for the game-token system: the default validity, the store
 * bundles players can buy, and a manual grant/refund tool (goodwill, weather
 * call-offs, testing). Config + bundle edits go through the token RLS admin
 * policies; grants/refunds go through the admin-gated SECURITY DEFINER RPCs.
 */
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { TokenAdminManager } from "@/components/admin/TokenAdminManager";

export const metadata: Metadata = { title: "LaserOps Game Tokens" };

export default async function AdminTokensPage() {
  const supabase = await createClient();
  const [{ data: config }, { data: bundles }] = await Promise.all([
    supabase.from("token_config").select("default_validity_months").eq("id", 1).maybeSingle(),
    supabase
      .from("token_bundles")
      .select("id, name, tokens, price_eur, validity_months, is_active, sort_order")
      .order("sort_order", { ascending: true, nullsFirst: false }),
  ]);

  return (
    <div>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">LaserOps Game Tokens</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          1 token = 1 free game. Set how long bundles stay valid, manage the store bundles players can buy, and grant or
          refund tokens by hand. Every grant, spend, and refund is recorded in the ledger and shows on the financial
          reports.
        </p>
      </header>

      <TokenAdminManager
        defaultValidityMonths={config?.default_validity_months ?? 6}
        initialBundles={(bundles ?? []).map((b) => ({
          id: b.id,
          name: b.name,
          tokens: Number(b.tokens),
          price_eur: Number(b.price_eur),
          validity_months: b.validity_months,
          is_active: b.is_active,
          sort_order: b.sort_order,
        }))}
      />
    </div>
  );
}
