/**
 * app/admin/scoring/history/page.tsx
 * --------------------------------------------------------------------
 * Scoring formula version history + rollback, per game mode. Lists every saved
 * version of the selected mode's formula (newest first) with who/when + the
 * written formula, and lets an admin restore an older version (re-applies it
 * going forward; past scores unaffected).
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { parseFormula, formulaExpression } from "@/lib/scoring/formula";
import { RestoreFormulaButton } from "@/components/admin/RestoreFormulaButton";

export const metadata = { title: "Scoring history" };

type Row = {
  id: number;
  actor_ops_tag: string | null;
  new_data: { structure?: unknown; mode_slug?: string } | null;
  created_at: string;
};

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ScoringHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode: modeParam } = await searchParams;
  const supabase = await createClient();

  const { data: modeRows } = await supabase
    .from("game_modes")
    .select("name, slug, is_default")
    .order("sort_order");
  const modes = (modeRows ?? []) as { name: string; slug: string; is_default: boolean }[];
  const selected =
    modes.find((m) => m.slug === modeParam) ?? modes.find((m) => m.is_default) ?? modes[0];
  const modeSlug = selected?.slug ?? "domination";

  const { data } = await supabase
    .from("admin_audit_log")
    .select("id, actor_ops_tag, new_data, created_at")
    .eq("table_name", "score_formula")
    .in("action", ["INSERT", "UPDATE"])
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = ((data ?? []) as Row[]).filter((r) => r.new_data?.mode_slug === modeSlug);

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 text-xs">
        <Link href={`/admin/scoring?mode=${modeSlug}`} className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
          ← Scoring formula
        </Link>
      </div>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
          Formula history
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          {selected?.name ?? modeSlug} · every saved version. Restoring re-applies that formula
          going forward — it does not undo scoring already done.
        </p>
      </header>

      {/* Mode tabs */}
      {modes.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {modes.map((m) => (
            <Link
              key={m.slug}
              href={`/admin/scoring/history?mode=${m.slug}`}
              className={`border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] ${
                m.slug === modeSlug ? "border-accent text-accent" : "border-border-strong text-text-muted hover:text-accent"
              }`}
            >
              {m.name}
            </Link>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">
          No saved versions for this mode yet. Save its formula once to start the history.
        </p>
      ) : (
        <ol className="space-y-3">
          {rows.map((r, i) => {
            const expr = r.new_data?.structure
              ? formulaExpression(parseFormula(r.new_data.structure))
              : "—";
            return (
              <li key={r.id} className="border border-border bg-bg-elevated px-4 py-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm">
                    <span className="font-semibold text-accent">{r.actor_ops_tag ?? "System"}</span>{" "}
                    <span className="text-text-muted">saved</span>
                    {i === 0 && (
                      <span className="ml-2 border border-accent px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.14em] text-accent">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-text-subtle">{when(r.created_at)}</span>
                    {i !== 0 && r.new_data?.structure ? (
                      <RestoreFormulaButton structure={r.new_data.structure} modeSlug={modeSlug} />
                    ) : null}
                  </div>
                </div>
                <p className="overflow-x-auto whitespace-nowrap font-mono text-xs text-text-muted">
                  {expr}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
