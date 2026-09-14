/**
 * app/admin/ratings/page.tsx
 * --------------------------------------------------------------------
 * Player rating config. Two parts:
 *   - rating_config: eligibility gates + the eight component weights that make
 *     up the overall rating (they should sum to 1).
 *   - rating_brackets: the 0..5 star percentile bands.
 * Both saves are gated (TOTP). A live banner flags when the weights drift off 1.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyValueConfigEditor, type FieldSpec } from "@/components/admin/KeyValueConfigEditor";
import { ConfigTableEditor, type ColumnSpec, type EditableRow } from "@/components/admin/ConfigTableEditor";

export const metadata = { title: "Ratings" };

const WEIGHT_KEYS = [
  "Match_Win_Rating",
  "Rounds_WL_Rating",
  "Kills_Per_Match_Rating",
  "Damage_Rating",
  "Accuracy_Rating",
  "KD_Rating",
  "Match_Rating_Rating",
  "Objective_1_Rating",
  "Objective_2_Rating",
];

const RATING_FIELDS: FieldSpec[] = [
  { key: "Min_Level", label: "Minimum level", help: "A player must reach this level to be rated.", group: "Eligibility gates", step: "1" },
  { key: "Min_Matches", label: "Minimum online matches", help: "Minimum ONLINE-scored matches a player needs to be rated — this guarantees objective (capture / hold) data exists. Once past it, their other components still count all games, offline included.", group: "Eligibility gates", step: "1" },
  { key: "Min_Eligible_Pool", label: "Minimum eligible pool", help: "Fewest eligible players before ratings are shown at all.", group: "Eligibility gates", step: "1" },

  { key: "Objective_1_Rating", label: "Objective play 1", help: "Objective slot 1 — each game mode maps one of its objectives here (Domination: hold time). Fed by online games only.", group: "Component weights (sum to 1)" },
  { key: "Objective_2_Rating", label: "Objective play 2", help: "Objective slot 2 — each game mode maps one of its objectives here (Domination: captures). Fed by online games only.", group: "Component weights (sum to 1)" },
  { key: "KD_Rating", label: "K/D ratio", group: "Component weights (sum to 1)" },
  { key: "Match_Rating_Rating", label: "Match rating", group: "Component weights (sum to 1)" },
  { key: "Accuracy_Rating", label: "Accuracy", group: "Component weights (sum to 1)" },
  { key: "Kills_Per_Match_Rating", label: "Kills per match", group: "Component weights (sum to 1)" },
  { key: "Damage_Rating", label: "Damage", group: "Component weights (sum to 1)" },
  { key: "Rounds_WL_Rating", label: "Rounds W/L", group: "Component weights (sum to 1)" },
  { key: "Match_Win_Rating", label: "Match win", group: "Component weights (sum to 1)" },
];

const BRACKET_COLUMNS: ColumnSpec[] = [
  { key: "stars", label: "Stars", kind: "number", align: "center", width: "5rem", step: "1" },
  { key: "label", label: "Label", kind: "text" },
  { key: "min_percentile", label: "Min percentile", kind: "number", align: "right" },
  { key: "max_percentile", label: "Max percentile", kind: "number", align: "right" },
  { key: "sort_order", label: "Order", kind: "number", align: "right", width: "5rem", step: "1" },
];

export default async function AdminRatingsPage() {
  const supabase = await createClient();
  const [{ data: cfgRows }, { data: bracketRows }] = await Promise.all([
    supabase.from("rating_config").select("key, value"),
    supabase
      .from("rating_brackets")
      .select("id, stars, label, min_percentile, max_percentile, sort_order")
      .order("sort_order"),
  ]);

  const initial: Record<string, string> = {};
  for (const r of (cfgRows ?? []) as { key: string; value: number | null }[]) {
    initial[r.key] = r.value === null ? "" : String(r.value);
  }

  const bracketInitial = ((bracketRows ?? []) as EditableRow[]).map((r) => ({ ...r }));

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
            Ratings
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Who gets a star rating, and how the overall score is weighted.
          </p>
        </div>
        <Link
          href="/admin/changelog?g=progression"
          className="flex h-10 items-center border border-border-strong px-4 text-xs font-bold uppercase tracking-[0.12em] text-text-muted hover:border-accent hover:text-accent"
        >
          Change log
        </Link>
      </header>

      <div className="mb-6 border-l-4 border-amber-500 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90">
        <span className="font-semibold text-amber-300">Heads up –</span> these weights and gates are
        finely tuned so ratings compare players fairly. Changing them re-ranks everyone on the next
        read, so adjust deliberately. The component weights must sum to 1, or ratings get skewed.
      </div>

      <section className="mb-10">
        <KeyValueConfigEditor
          table="rating_config"
          columnKind="numeric"
          fields={RATING_FIELDS}
          initial={initial}
          gateAction="the rating settings"
          weightSum={{ keys: WEIGHT_KEYS, target: 1, label: "Component weights" }}
        />
      </section>

      <section>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-[0.12em] text-accent">Star bands</h2>
        <p className="mb-4 text-xs text-text-muted">
          Percentile ranges for each star count (0 = unrated / default). Percentiles run 0 to 1.
        </p>
        <ConfigTableEditor
          table="rating_brackets"
          columns={BRACKET_COLUMNS}
          initialRows={bracketInitial}
          gateAction="the rating star bands"
          canAdd
          canDelete
          addLabel="+ Add band"
          autoIncrement="sort_order"
          newRowTemplate={{ stars: "", label: "", min_percentile: "", max_percentile: "", sort_order: "" }}
        />
      </section>
    </div>
  );
}
