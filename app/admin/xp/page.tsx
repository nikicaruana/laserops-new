/**
 * app/admin/xp/page.tsx
 * --------------------------------------------------------------------
 * XP & Levels config. Two parts:
 *   - xp_config: the win-XP bonuses (round + match).
 *   - rank_levels: the 1..50 progression ladder (name, score threshold,
 *     estimated games, badge).
 * Both saves are gated (TOTP) as progression changes. Accolade / streak XP
 * live on their own definition tables, not here.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyValueConfigEditor, type FieldSpec } from "@/components/admin/KeyValueConfigEditor";
import { ConfigTableEditor, type ColumnSpec, type EditableRow } from "@/components/admin/ConfigTableEditor";

export const metadata = { title: "XP & Levels" };

const XP_FIELDS: FieldSpec[] = [
  { key: "Round_Win_XP", label: "Round win XP", help: "XP awarded for winning a round." },
  { key: "Match_Win_XP", label: "Match win XP", help: "XP awarded for winning a match." },
];

const RANK_COLUMNS: ColumnSpec[] = [
  { key: "level", label: "Lvl", kind: "readonly", width: "3.5rem", align: "center" },
  { key: "rank_name", label: "Rank name", kind: "text" },
  { key: "score_threshold", label: "Score threshold", kind: "number", align: "right" },
  { key: "est_games", label: "Est. games", kind: "number", align: "right", width: "6rem" },
  { key: "badge_url", label: "Badge", kind: "image", width: "5rem" },
];

export default async function AdminXpPage() {
  const supabase = await createClient();
  const [{ data: xpRows }, { data: rankRows }] = await Promise.all([
    supabase.from("xp_config").select("key, value"),
    supabase
      .from("rank_levels")
      .select("id, level, rank_name, score_threshold, est_games, badge_url")
      .order("level"),
  ]);

  const xpInitial: Record<string, string> = {};
  for (const r of (xpRows ?? []) as { key: string; value: number | null }[]) {
    xpInitial[r.key] = r.value === null ? "" : String(r.value);
  }

  const rankInitial = ((rankRows ?? []) as EditableRow[]).map((r) => ({ ...r }));

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
            XP &amp; Levels
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Win-XP bonuses and the 1&ndash;50 rank ladder.
          </p>
        </div>
        <Link
          href="/admin/changelog?g=progression"
          className="flex h-10 items-center border border-border-strong px-4 text-xs font-bold uppercase tracking-[0.12em] text-text-muted hover:border-accent hover:text-accent"
        >
          Change log
        </Link>
      </header>

      <section className="mb-10">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.12em] text-accent">Win bonuses</h2>
        <KeyValueConfigEditor
          table="xp_config"
          columnKind="numeric"
          fields={XP_FIELDS}
          initial={xpInitial}
          gateAction="the win-XP bonuses"
        />
      </section>

      <section>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-[0.12em] text-accent">Rank ladder</h2>
        <p className="mb-4 text-xs text-text-muted">
          A player&apos;s rank is the highest level whose score threshold they have passed. Editing
          thresholds re-buckets players on the next read; it does not change their score.
        </p>
        <ConfigTableEditor
          table="rank_levels"
          columns={RANK_COLUMNS}
          initialRows={rankInitial}
          imageKind="rank"
          gateAction="the rank ladder"
        />
      </section>
    </div>
  );
}
