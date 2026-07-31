/**
 * app/admin/guns/new/page.tsx
 * --------------------------------------------------------------------
 * Create a new gun. Renders the shared GunEditor in create mode with a blank
 * template (sort order pre-filled to the end of the list, initial damage
 * editable so the insert trigger seeds the damage timeline). On save it
 * inserts and redirects to the new gun's edit page.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GunEditor, type GunRecord } from "@/components/admin/GunEditor";

export const metadata = { title: "New gun" };

export default async function NewGunPage() {
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("guns")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (last?.sort_order ?? 0) + 1;

  const blank: GunRecord = {
    id: "",
    name: "",
    image_url: "",
    class: "",
    tree_branch: "",
    is_default: false,
    is_visible: true,
    sort_order: nextSort,
    unlock_type: "Default",
    unlock_prerequisite_class: "",
    unlock_prerequisite_gun: "",
    unlock_requirement_points: null,
    unlock_requirement_level: null,
    unlock_display_text: "",
    unlock_tier: "",
    mag_size: null,
    reload: null,
    fire_rate: "",
    difficulty: "",
    description: "",
    damage: null,
    length: null,
    weight: null,
    gun_range: null,
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 text-xs">
        <Link href="/admin/guns" className="font-semibold uppercase tracking-[0.12em] text-text-subtle hover:text-accent">
          ← Guns
        </Link>
      </div>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
          New gun
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Add a weapon to the catalogue. After creating, you can manage its
          damage timeline on the edit page.
        </p>
      </header>

      <div className="max-w-3xl">
        <GunEditor gun={blank} mode="create" />
      </div>
    </div>
  );
}
