/**
 * app/admin/changelog/page.tsx
 * --------------------------------------------------------------------
 * Admin change log — who changed what config, when. Optionally filtered to one
 * section via ?table=<name>. Reads admin_audit_log (admin-read RLS).
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChangeLogList } from "@/components/admin/ChangeLogList";
import { type AuditEntry } from "@/lib/admin/audit";

export const metadata = { title: "Change log" };

// Grouped section filters (a group can span several tables).
const GROUPS: { key: string; label: string; tables: string[] }[] = [
  { key: "guns", label: "Guns", tables: ["guns", "gun_classes", "gun_tree_branches"] },
  { key: "accolades", label: "Accolades", tables: ["accolade_definitions", "accolade_rules"] },
  { key: "scoring", label: "Scoring", tables: ["score_formula", "game_modes"] },
  {
    key: "progression",
    label: "XP / ELO / Ratings / Streaks",
    tables: [
      "xp_config",
      "rank_levels",
      "elo_config",
      "elo_tiers",
      "rating_config",
      "rating_brackets",
      "streak_definitions",
      "streak_rules",
    ],
  },
  { key: "exploit", label: "Exploit control", tables: ["spawn_camp_config", "base_trading_config"] },
];

export default async function ChangeLogPage({
  searchParams,
}: {
  searchParams: Promise<{ g?: string }>;
}) {
  const { g } = await searchParams;
  const group = GROUPS.find((x) => x.key === g);

  const supabase = await createClient();
  let query = supabase
    .from("admin_audit_log")
    .select("id, actor_ops_tag, table_name, row_id, action, old_data, new_data, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (group) query = query.in("table_name", group.tables);
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
            !group ? "border-accent text-accent" : "border-border-strong text-text-muted hover:text-accent"
          }`}
        >
          All
        </Link>
        {GROUPS.map((gr) => (
          <Link
            key={gr.key}
            href={`/admin/changelog?g=${gr.key}`}
            className={`border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] ${
              group?.key === gr.key ? "border-accent text-accent" : "border-border-strong text-text-muted hover:text-accent"
            }`}
          >
            {gr.label}
          </Link>
        ))}
      </div>

      <ChangeLogList entries={(data ?? []) as AuditEntry[]} />
    </div>
  );
}
