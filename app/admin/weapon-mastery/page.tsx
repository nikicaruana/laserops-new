import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { WeaponMasteryManager, type MasteryItem } from "@/components/admin/WeaponMasteryManager";

export const metadata: Metadata = { title: "Weapon mastery" };

type MasteryRow = {
  id: string;
  gun_name: string;
  enabled: boolean;
  sort_order: number | null;
  bronze_badge_url: string | null;
  silver_badge_url: string | null;
  gold_badge_url: string | null;
  platinum_badge_url: string | null;
};

export default async function WeaponMasteryPage() {
  const supabase = await createClient();
  const [{ data: guns }, { data: rows }] = await Promise.all([
    supabase.from("guns").select("name").order("name"),
    supabase
      .from("weapon_mastery")
      .select("id, gun_name, enabled, sort_order, bronze_badge_url, silver_badge_url, gold_badge_url, platinum_badge_url"),
  ]);

  const byGun = new Map(((rows ?? []) as MasteryRow[]).map((r) => [r.gun_name, r]));
  const items: MasteryItem[] = ((guns ?? []) as { name: string }[]).map((g) => {
    const r = byGun.get(g.name);
    return {
      gunName: g.name,
      id: r?.id ?? null,
      enabled: r?.enabled ?? false,
      sortOrder: r?.sort_order ?? null,
      bronze: r?.bronze_badge_url ?? null,
      silver: r?.silver_badge_url ?? null,
      gold: r?.gold_badge_url ?? null,
      platinum: r?.platinum_badge_url ?? null,
    };
  });

  return (
    <div>
      <h1 className="mb-2 text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Weapon mastery</h1>
      <p className="mb-6 max-w-2xl text-sm text-text-muted">
        Bronze &rarr; Platinum mastery per gun. Badge art is uploaded here; the challenges a player
        must complete follow the streak &amp; accolade tiers automatically.
      </p>
      <WeaponMasteryManager items={items} />
    </div>
  );
}
