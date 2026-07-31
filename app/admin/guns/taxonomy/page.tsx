/**
 * app/admin/guns/taxonomy/page.tsx
 * --------------------------------------------------------------------
 * Manage the gun taxonomy: the canonical Gun Classes and Tree Branches the
 * gun editor offers as dropdowns. Loads both lists; editing happens client-side.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TaxonomyList, type TaxItem } from "@/components/admin/TaxonomyList";

export const metadata = { title: "Classes & Trees" };

export default async function GunTaxonomyPage() {
  const supabase = await createClient();
  const [{ data: classes }, { data: branches }] = await Promise.all([
    supabase.from("gun_classes").select("id, name, sort_order").order("sort_order"),
    supabase.from("gun_tree_branches").select("id, name, sort_order").order("sort_order"),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 text-xs">
        <Link href="/admin/guns" className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
          ← Guns
        </Link>
      </div>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
          Classes &amp; Tree Branches
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          The canonical lists the gun editor offers as dropdowns. Reorder to set
          the order they appear in.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <TaxonomyList
          title="Gun classes"
          hint="e.g. AR, SMG, LMG, Sniper, DMR, Shotgun."
          table="gun_classes"
          gunColumn="class"
          initialItems={(classes ?? []) as TaxItem[]}
        />
        <TaxonomyList
          title="Tree branches"
          hint="Unlock-tree groupings guns are organised under in the armory."
          table="gun_tree_branches"
          gunColumn="tree_branch"
          initialItems={(branches ?? []) as TaxItem[]}
        />
      </div>
    </div>
  );
}
