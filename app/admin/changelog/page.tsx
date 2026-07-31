/**
 * app/admin/changelog/page.tsx
 * --------------------------------------------------------------------
 * Admin change log — who changed what config, when. Optionally filtered to one
 * section via ?table=<name>. Reads admin_audit_log (admin-read RLS).
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChangeLogList } from "@/components/admin/ChangeLogList";
import { TABLE_LABELS, tableLabel, type AuditEntry } from "@/lib/admin/audit";

export const metadata = { title: "Change log" };

// Sections worth offering as quick filters.
const FILTERS = [
  "guns",
  "gun_classes",
  "gun_tree_branches",
  "accolade_definitions",
  "accolade_rules",
  "score_formula",
];

export default async function ChangeLogPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const { table } = await searchParams;
  const active = table && TABLE_LABELS[table] ? table : undefined;

  const supabase = await createClient();
  let query = supabase
    .from("admin_audit_log")
    .select("id, actor_ops_tag, table_name, row_id, action, old_data, new_data, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (active) query = query.eq("table_name", active);
  const { data } = await query;

  return (
    <div>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
          Change log
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Every config change, most recent first — who made it and when.
        </p>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        <Link
          href="/admin/changelog"
          className={`border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] ${
            !active ? "border-accent text-accent" : "border-border-strong text-text-muted hover:text-accent"
          }`}
        >
          All
        </Link>
        {FILTERS.map((t) => (
          <Link
            key={t}
            href={`/admin/changelog?table=${t}`}
            className={`border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] ${
              active === t ? "border-accent text-accent" : "border-border-strong text-text-muted hover:text-accent"
            }`}
          >
            {tableLabel(t)}
          </Link>
        ))}
      </div>

      <ChangeLogList entries={(data ?? []) as AuditEntry[]} />
    </div>
  );
}
