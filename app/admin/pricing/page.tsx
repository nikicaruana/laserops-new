/**
 * app/admin/pricing/page.tsx
 * --------------------------------------------------------------------
 * Pricing & sessions admin: the normal game price, session length and enforced
 * break between bookings (pricing_config), plus the permanent family & friends
 * per-player discounts. Reads config + discounted accounts through the admin
 * session.
 */
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PricingConfigEditor } from "@/components/admin/PricingConfigEditor";
import { DiscountManager } from "@/components/admin/DiscountManager";

export const metadata: Metadata = { title: "Pricing" };

export default async function PricingPage() {
  const supabase = await createClient();
  const [{ data: cfg }, { data: discounted }] = await Promise.all([
    supabase.from("pricing_config").select("default_price_eur, session_minutes, booking_buffer_minutes").eq("id", 1).maybeSingle(),
    supabase.from("accounts").select("id, ops_tag, discount_pct").gt("discount_pct", 0).order("discount_pct", { ascending: false }),
  ]);

  const initial = (discounted ?? []).map((a) => ({
    id: a.id as string,
    opsTag: (a.ops_tag as string) ?? "",
    discountPct: Number(a.discount_pct) || 0,
  }));

  return (
    <div>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Pricing &amp; sessions</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          Set the normal price and how sessions are scheduled, and give specific players a permanent family &amp; friends
          discount.
        </p>
      </header>

      <PricingConfigEditor
        price={Number(cfg?.default_price_eur ?? 35)}
        sessionMinutes={Number(cfg?.session_minutes ?? 180)}
        bufferMinutes={Number(cfg?.booking_buffer_minutes ?? 60)}
      />

      <h2 className="mb-4 mt-10 text-sm font-bold uppercase tracking-[0.14em] text-text-subtle">Family &amp; friends discounts</h2>
      <DiscountManager initial={initial} />
    </div>
  );
}
