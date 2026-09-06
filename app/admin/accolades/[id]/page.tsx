/**
 * app/admin/accolades/[id]/page.tsx
 * --------------------------------------------------------------------
 * Edit one accolade definition + delete.
 */
import Link from "next/link";
import { cldImage } from "@/lib/cld";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccoladeEditor, type AccoladeRecord } from "@/components/admin/AccoladeEditor";
import { AccoladeRuleEditor, type AccoladeRule } from "@/components/admin/AccoladeRuleEditor";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("accolade_definitions").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ? `${data.name} · Accolades` : "Edit accolade" };
}

export default async function EditAccoladePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: accolade }, { data: rule }] = await Promise.all([
    supabase
      .from("accolade_definitions")
      .select("id, name, description, badge_url, xp, points, scope, is_active")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("accolade_rules")
      .select("id, rule_type, stat_key, direction, comparator, threshold_value, params")
      .eq("accolade_definition_id", id)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
  ]);
  if (!accolade) notFound();

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 text-xs">
        <Link href="/admin/accolades" className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
          ← Accolades
        </Link>
      </div>
      <header className="mb-8 flex items-center gap-4 border-b border-border pb-6">
        {accolade.badge_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cldImage(accolade.badge_url, { w: 384 })} alt="" className="h-12 w-12 shrink-0 object-contain" />
        )}
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
          {accolade.name}
        </h1>
      </header>

      <AccoladeEditor accolade={accolade as AccoladeRecord} />

      <div className="mt-6">
        <AccoladeRuleEditor
          accoladeId={accolade.id}
          initialRule={(rule ?? null) as AccoladeRule | null}
        />
      </div>

      <div className="max-w-2xl">
        <AdminDeleteButton
          table="accolade_definitions"
          id={accolade.id}
          name={accolade.name ?? "this accolade"}
          redirectTo="/admin/accolades"
          noun="accolade"
        />
      </div>
    </div>
  );
}
