/**
 * app/admin/scoring/page.tsx
 * --------------------------------------------------------------------
 * Per-mode match score formula builder. Pick a game mode (tab); each mode has
 * its own formula (falls back to the default shape until first saved). The
 * drag-and-drop builder + live worked example edit the selected mode.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ScoringFormulaEditor } from "@/components/admin/ScoringFormulaEditor";
import { parseFormula, defaultFormula } from "@/lib/scoring/formula";

export const metadata = { title: "Scoring formula" };

type Mode = { name: string; slug: string; is_default: boolean; sort_order: number | null };

export default async function AdminScoringPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode: modeParam } = await searchParams;
  const supabase = await createClient();

  const { data: modeRows } = await supabase
    .from("game_modes")
    .select("name, slug, is_default, sort_order")
    .order("sort_order");
  const modes = (modeRows ?? []) as Mode[];

  // Selected mode: ?mode= if valid, else the default, else the first.
  const selected =
    modes.find((m) => m.slug === modeParam) ??
    modes.find((m) => m.is_default) ??
    modes[0] ??
    null;
  const modeSlug = selected?.slug ?? "domination";

  const { data: formulaRow } = await supabase
    .from("score_formula")
    .select("structure")
    .eq("mode_slug", modeSlug)
    .maybeSingle();
  const formula = formulaRow?.structure ? parseFormula(formulaRow.structure) : defaultFormula();

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
            Scoring formula
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            A formula per game mode. Score = sum of the groups, rounded up.
          </p>
        </div>
        <Link
          href={`/admin/scoring/history?mode=${modeSlug}`}
          className="flex h-10 items-center border border-border-strong px-4 text-xs font-bold uppercase tracking-[0.12em] text-text-muted hover:border-accent hover:text-accent"
        >
          History &amp; rollback
        </Link>
      </header>

      {/* Mode tabs */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {modes.map((m) => (
          <Link
            key={m.slug}
            href={`/admin/scoring?mode=${m.slug}`}
            className={`border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] ${
              m.slug === modeSlug
                ? "border-accent bg-bg-elevated text-accent"
                : "border-border-strong text-text-muted hover:border-accent hover:text-accent"
            }`}
          >
            {m.name}
            {m.is_default && <span className="ml-1.5 text-[0.55rem] text-text-subtle">default</span>}
          </Link>
        ))}
        <Link
          href="/admin/scoring/modes"
          className="border border-dashed border-border-strong px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-subtle hover:border-accent hover:text-accent"
        >
          Manage modes
        </Link>
      </div>

      <div className="mb-6 border-l-4 border-amber-500 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90">
        <span className="font-semibold text-amber-300">Heads up —</span> this formula is finely
        tuned for the best gameplay experience. Changing it affects how every future match is
        scored, so adjust deliberately. Past games keep the score they were computed with.
      </div>

      {selected ? (
        <ScoringFormulaEditor key={modeSlug} initial={formula} modeSlug={modeSlug} />
      ) : (
        <p className="text-sm text-text-muted">
          No game modes yet.{" "}
          <Link href="/admin/scoring/modes" className="text-accent">Add one</Link> to start.
        </p>
      )}
    </div>
  );
}
