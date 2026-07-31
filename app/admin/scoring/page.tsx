/**
 * app/admin/scoring/page.tsx
 * --------------------------------------------------------------------
 * Match score formula builder. Loads the configurable formula structure from
 * score_formula (falls back to the default shape) and renders the drag-and-drop
 * builder + live worked example.
 */
import Link from "next/link";
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
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
            Scoring formula
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Build the match-score formula from metric blocks. Score = sum of the groups, rounded up.
          </p>
        </div>
        <Link
          href="/admin/scoring/history"
          className="flex h-10 items-center border border-border-strong px-4 text-xs font-bold uppercase tracking-[0.12em] text-text-muted hover:border-accent hover:text-accent"
        >
          History &amp; rollback
        </Link>
      </header>

      <div className="mb-6 border-l-4 border-amber-500 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90">
        <span className="font-semibold text-amber-300">Heads up —</span> this formula is finely
        tuned for the best gameplay experience. Changing it affects how every future match is
        scored, so adjust deliberately. Past games keep the score they were computed with.
      </div>

      <ScoringFormulaEditor initial={formula} />
    </div>
  );
}
