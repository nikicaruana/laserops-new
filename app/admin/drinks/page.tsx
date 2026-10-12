/**
 * app/admin/drinks/page.tsx
 * --------------------------------------------------------------------
 * Admin drinks menu: the list of drinks (name + price) players can add to their
 * post-game bill. Feeds the pay page total and the match-manager settlement.
 */
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DrinkMenuManager, type Drink } from "@/components/admin/DrinkMenuManager";

export const metadata: Metadata = { title: "Drinks menu" };

export default async function DrinksPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("drink_menu")
    .select("id, name, price_eur, sort_order, is_active")
    .order("sort_order", { ascending: true });

  const initial: Drink[] = (data ?? []).map((d) => ({
    id: d.id as string,
    name: (d.name as string) ?? "",
    price: Number(d.price_eur) || 0,
    sortOrder: Number(d.sort_order) || 0,
    isActive: Boolean(d.is_active),
  }));

  return (
    <div>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Drinks menu</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          Set the drinks and prices players can add to their bill when they settle up after a game.
        </p>
      </header>
      <DrinkMenuManager initial={initial} />
    </div>
  );
}
