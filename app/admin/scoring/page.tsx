/**
 * app/admin/scoring/page.tsx
 * --------------------------------------------------------------------
 * Match score formula editor. Loads the score_formula_config weights and
 * renders the tunable weights + a live worked example (ScoringFormulaEditor).
 */
import { createClient } from "@/lib/supabase/server";
import { ScoringFormulaEditor, type WeightRow } from "@/components/admin/ScoringFormulaEditor";

export const metadata = { title: "Scoring formula" };

export default async function AdminScoringPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("score_formula_config")
    .select("key, value, note");
  const rows = (data ?? []) as WeightRow[];

  return (
    <div>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
          Scoring formula
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Tune the match-score weights. The formula shape is fixed; the worked
          example shows the effect of every change before you save.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">No score formula config found.</p>
      ) : (
        <ScoringFormulaEditor rows={rows} />
      )}
    </div>
  );
}
