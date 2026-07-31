/**
 * app/admin/guns/[id]/page.tsx
 * --------------------------------------------------------------------
 * Edit a single gun: details form (all specs + unlock rules) and a separate
 * damage panel that manages the effective-dated damage timeline. Loads the
 * gun + its damage history server-side; the client components write back via
 * the admin's authenticated session (RLS + set_gun_damage).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GunEditor, type GunRecord } from "@/components/admin/GunEditor";
import { GunDamagePanel, type DamageWindow } from "@/components/admin/GunDamagePanel";
import { GunDeleteButton } from "@/components/admin/GunDeleteButton";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("guns").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ? `${data.name} · Guns` : "Edit gun" };
}

export default async function EditGunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: gun }, { data: history }, { data: classes }, { data: branches }] =
    await Promise.all([
      supabase.from("guns").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("gun_damage_history")
        .select("id, damage, effective_from, effective_to, note")
        .eq("gun_id", id)
        .order("effective_from", { ascending: false }),
      supabase.from("gun_classes").select("name").order("sort_order"),
      supabase.from("gun_tree_branches").select("name").order("sort_order"),
    ]);

  if (!gun) notFound();

  const classOptions = (classes ?? []).map((c) => c.name as string);
  const treeOptions = (branches ?? []).map((b) => b.name as string);

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 text-xs">
        <Link href="/admin/guns" className="font-semibold uppercase tracking-[0.12em] text-text-subtle hover:text-accent">
          ← Guns
        </Link>
      </div>
      <header className="mb-8 flex items-center gap-4 border-b border-border pb-6">
        {gun.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={gun.image_url} alt="" className="h-12 w-20 shrink-0 object-contain" />
        )}
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
            {gun.name}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {gun.class} · {gun.tree_branch}
          </p>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,22rem)]">
        <GunEditor gun={gun as GunRecord} classOptions={classOptions} treeOptions={treeOptions} />
        <GunDamagePanel
          gunId={gun.id}
          currentDamage={gun.damage}
          history={(history ?? []) as DamageWindow[]}
        />
      </div>

      <GunDeleteButton gunId={gun.id} gunName={gun.name ?? "this gun"} />
    </div>
  );
}
