/**
 * app/admin/scoring/page.tsx
 * --------------------------------------------------------------------
 * Match score formula builder. Loads the configurable formula structure from
 * score_formula (falls back to the default shape) and renders the drag-and-drop
 * builder + live worked example.
 */
import { createClient } from "@/lib/supabase/server";
import { ScoringFormulaEditor } from "@/components/admin/ScoringFormulaEditor";
import { parseFormula, defaultFormula } from "@/lib/scoring/formula";

export const metadata = { title: "Scoring formula" };

export default async function AdminScoringPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("score_formula").select("structure").maybeSingle();
  const formula = data?.structure ? parseFormula(data.structure) : defaultFormula();

  return (
    <div>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
          Scoring formula
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Build the match-score formula from metric blocks. Score = sum of the groups, rounded up.
        </p>
      </header>

      <ScoringFormulaEditor initial={formula} />
    </div>
  );
}
