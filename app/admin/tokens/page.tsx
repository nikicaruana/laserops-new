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
import { TokenPackRequests } from "@/components/admin/TokenPackRequests";

export const metadata: Metadata = { title: "LaserOps Game Tokens" };

export default async function AdminTokensPage() {
  const supabase = await createClient();
  const [{ data: config }, { data: bundles }, { data: requests }] = await Promise.all([
    supabase.from("token_config").select("default_validity_months").eq("id", 1).maybeSingle(),
    supabase
      .from("token_bundles")
      .select("id, name, tokens, price_eur, validity_months, is_active, sort_order")
      .order("sort_order", { ascending: true, nullsFirst: false }),
    supabase
      .from("token_pack_requests")
      .select("id, bundle_name, tokens, price_eur, created_at, account:accounts!account_id(ops_tag, full_name, email, phone_e164)")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
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

      <TokenPackRequests
        initial={(requests ?? []).map((r) => {
          const acc = Array.isArray(r.account) ? r.account[0] : r.account;
          return {
            id: r.id as string,
            bundle_name: r.bundle_name as string,
            tokens: Number(r.tokens),
            price_eur: Number(r.price_eur),
            created_at: r.created_at as string,
            account: acc ? { ops_tag: acc.ops_tag ?? null, full_name: acc.full_name ?? null, email: acc.email ?? null, phone: acc.phone_e164 ?? null } : null,
          };
        })}
      />

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
