"use client";

/**
 * components/admin/ScoringFormulaEditor.tsx
 * --------------------------------------------------------------------
 * Drag-and-drop builder for the configurable match-score formula. The score is
 * the sum of GROUPS; each group has additive metric blocks and its own
 * multipliers. Blocks are draggable between a group's base/multiplier areas and
 * between groups (moving a block changes its role). A live worked example shows
 * the effect of every change before saving. Persists the whole structure as
 * jsonb to score_formula (admin-write RLS).
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import {
  computeGroupValue,
  computeScore,
  FORMULA_STATS,
  type FormulaBlock,
  type FormulaGroup,
  type ScoreFormula,
} from "@/lib/scoring/formula";

// Single operator install — the default operator the schema uses everywhere.
const OPERATOR_ID = "00000000-0000-0000-0000-000000000001";

type Area = "baseTerms" | "multipliers";
type Sample = {
  frags: number;
  hits: number;
  gunDamage: number;
  captures: number;
  hold: number;
  accuracyPct: number;
  kd: number;
};

const input =
  "h-9 rounded-none border border-border-strong bg-bg px-2 text-sm text-text focus:border-accent focus:outline-none";
const nf = (n: number, d = 0) =>
  n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: 0 });
const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random()}`;

export function ScoringFormulaEditor({ initial }: { initial: ScoreFormula }) {
  const router = useRouter();
  const [formula, setFormula] = useState<ScoreFormula>(initial);
  const [sample, setSample] = useState<Sample>({
    frags: 30,
    hits: 200,
    gunDamage: 25,
    captures: 3,
    hold: 40,
    accuracyPct: 22,
    kd: 1.29,
  });
  const [dragId, setDragId] = useState<string | null>(null);
  const [overZone, setOverZone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = () => setSaved(false);

  /* ---- structure mutations (immutable) ---- */
  function updateBlock(id: string, patch: Partial<FormulaBlock>) {
    setFormula((f) => ({
      groups: f.groups.map((g) => ({
        ...g,
        baseTerms: g.baseTerms.map((b) => (b.id === id ? { ...b, ...patch } : b)),
        multipliers: g.multipliers.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      })),
    }));
    dirty();
  }
  function removeBlock(id: string) {
    setFormula((f) => ({
      groups: f.groups.map((g) => ({
        ...g,
        baseTerms: g.baseTerms.filter((b) => b.id !== id),
        multipliers: g.multipliers.filter((b) => b.id !== id),
      })),
    }));
    dirty();
  }
  function addBlock(groupId: string, area: Area) {
    const block: FormulaBlock = {
      id: newId(),
      stat: area === "baseTerms" ? "frags" : "accuracy",
      weight: area === "baseTerms" ? 1 : 0.1,
    };
    setFormula((f) => ({
      groups: f.groups.map((g) => (g.id === groupId ? { ...g, [area]: [...g[area], block] } : g)),
    }));
    dirty();
  }
  function moveBlock(id: string, targetGroupId: string, area: Area, beforeId: string | null) {
    setFormula((f) => {
      const moved = f.groups
        .flatMap((g) => [...g.baseTerms, ...g.multipliers])
        .find((b) => b.id === id);
      if (!moved) return f;
      const stripped = f.groups.map((g) => ({
        ...g,
        baseTerms: g.baseTerms.filter((b) => b.id !== id),
        multipliers: g.multipliers.filter((b) => b.id !== id),
      }));
      return {
        groups: stripped.map((g) => {
          if (g.id !== targetGroupId) return g;
          const list = [...g[area]];
          const idx = beforeId ? list.findIndex((b) => b.id === beforeId) : -1;
          if (idx >= 0) list.splice(idx, 0, moved);
          else list.push(moved);
          return { ...g, [area]: list };
        }),
      };
    });
    dirty();
  }
  function addGroup() {
    setFormula((f) => ({
      groups: [...f.groups, { id: newId(), label: "New group", baseTerms: [], multipliers: [] }],
    }));
    dirty();
  }
  function removeGroup(groupId: string) {
    setFormula((f) => ({ groups: f.groups.filter((g) => g.id !== groupId) }));
    dirty();
  }
  function setGroupLabel(groupId: string, label: string) {
    setFormula((f) => ({
      groups: f.groups.map((g) => (g.id === groupId ? { ...g, label } : g)),
    }));
    dirty();
  }

  /* ---- live compute ---- */
  const stats = useMemo<Record<string, number>>(
    () => ({
      frags: sample.frags,
      damage: sample.hits * sample.gunDamage,
      captures: sample.captures,
      hold: sample.hold,
      accuracy: sample.accuracyPct / 100,
      kd: sample.kd,
    }),
    [sample],
  );
  const score = computeScore(formula, stats);

  async function save() {
    setError(null);
    setSaved(false);
    setSaving(true);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("score_formula")
      .upsert({ operator_id: OPERATOR_ID, structure: formula }, { onConflict: "operator_id" });
    setSaving(false);
    if (err) {
      setError(err.message || "Couldn't save the formula.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  /* ---- block card ---- */
  const BlockCard = ({ block, groupId, area }: { block: FormulaBlock; groupId: string; area: Area }) => (
    <div
      draggable
      onDragStart={() => setDragId(block.id)}
      onDragEnd={() => {
        setDragId(null);
        setOverZone(null);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dragId && dragId !== block.id) moveBlock(dragId, groupId, area, block.id);
        setDragId(null);
        setOverZone(null);
      }}
      className={`flex items-center gap-2 border border-border-strong bg-bg px-2 py-1.5 ${
        dragId === block.id ? "opacity-40" : ""
      }`}
    >
      <span className="cursor-grab select-none text-text-subtle" aria-hidden>⠿</span>
      {area === "multipliers" && <span className="font-mono text-xs text-text-subtle">1+</span>}
      <select
        value={block.stat}
        onChange={(e) => updateBlock(block.id, { stat: e.target.value })}
        className={`${input} min-w-0 flex-1`}
      >
        {FORMULA_STATS.map((s) => (
          <option key={s.key} value={s.key}>{s.label}</option>
        ))}
      </select>
      <span className="text-text-subtle">×</span>
      <input
        type="number"
        step="any"
        value={block.weight}
        onChange={(e) => updateBlock(block.id, { weight: Number(e.target.value) })}
        className={`${input} w-20`}
      />
      <button
        type="button"
        onClick={() => removeBlock(block.id)}
        aria-label="Remove"
        className="flex h-6 w-6 shrink-0 items-center justify-center text-text-subtle hover:text-red-400"
      >
        ✕
      </button>
    </div>
  );

  /* ---- drop zone ---- */
  const Zone = ({
    groupId,
    area,
    children,
  }: {
    groupId: string;
    area: Area;
    children: React.ReactNode;
  }) => {
    const key = `${groupId}:${area}`;
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOverZone(key);
        }}
        onDragLeave={() => setOverZone((z) => (z === key ? null : z))}
        onDrop={(e) => {
          e.preventDefault();
          if (dragId) moveBlock(dragId, groupId, area, null);
          setDragId(null);
          setOverZone(null);
        }}
        className={`min-h-[3rem] space-y-2 border border-dashed p-2 transition-colors ${
          overZone === key ? "border-accent bg-accent/5" : "border-border"
        }`}
      >
        {children}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-text-muted">
          Drag blocks between a group&rsquo;s base and multiplier areas, or into another group. Score
          = sum of all groups, rounded up.
        </p>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-accent">Saved.</span>}
          <button
            type="button"
            onClick={addGroup}
            className="h-10 border border-border-strong px-4 text-xs font-bold uppercase tracking-[0.12em] text-text-muted hover:border-accent hover:text-accent"
          >
            + Group
          </button>
          <Button type="button" size="md" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save formula"}
          </Button>
        </div>
      </div>
      {error && (
        <p className="border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-400">{error}</p>
      )}

      {/* Groups */}
      <div className="space-y-4">
        {formula.groups.map((g, gi) => {
          const value = computeGroupValue(g, stats);
          return (
            <div key={g.id}>
              {gi > 0 && (
                <div className="mb-4 text-center font-mono text-lg text-text-subtle">+</div>
              )}
              <section className="border border-border bg-bg-elevated px-5 py-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <input
                    value={g.label}
                    onChange={(e) => setGroupLabel(g.id, e.target.value)}
                    className={`${input} h-8 max-w-[16rem] flex-1 font-semibold`}
                  />
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-accent">= {nf(value, 1)}</span>
                    {formula.groups.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeGroup(g.id)}
                        aria-label="Remove group"
                        className="text-text-subtle hover:text-red-400"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-text-muted">
                        Base terms (added)
                      </p>
                      <button
                        type="button"
                        onClick={() => addBlock(g.id, "baseTerms")}
                        className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-accent hover:text-accent-soft"
                      >
                        + Metric
                      </button>
                    </div>
                    <Zone groupId={g.id} area="baseTerms">
                      {g.baseTerms.length === 0 && (
                        <p className="py-1 text-center text-[0.65rem] text-text-subtle">Drop metrics here</p>
                      )}
                      {g.baseTerms.map((b) => (
                        <BlockCard key={b.id} block={b} groupId={g.id} area="baseTerms" />
                      ))}
                    </Zone>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-text-muted">
                        × Multipliers
                      </p>
                      <button
                        type="button"
                        onClick={() => addBlock(g.id, "multipliers")}
                        className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-accent hover:text-accent-soft"
                      >
                        + Multiplier
                      </button>
                    </div>
                    <Zone groupId={g.id} area="multipliers">
                      {g.multipliers.length === 0 && (
                        <p className="py-1 text-center text-[0.65rem] text-text-subtle">
                          No multipliers — base only
                        </p>
                      )}
                      {g.multipliers.map((b) => (
                        <BlockCard key={b.id} block={b} groupId={g.id} area="multipliers" />
                      ))}
                    </Zone>
                  </div>
                </div>
              </section>
            </div>
          );
        })}
      </div>

      {/* Worked example */}
      <section className="border border-accent/40 bg-bg-elevated px-5 py-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.12em] text-accent">Worked example</h2>
        <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4 lg:grid-cols-7">
          {(
            [
              ["Frags", "frags"],
              ["Hits", "hits"],
              ["Gun dmg", "gunDamage"],
              ["Captures", "captures"],
              ["Hold (s)", "hold"],
              ["Accuracy %", "accuracyPct"],
              ["K/D", "kd"],
            ] as [string, keyof Sample][]
          ).map(([label, key]) => (
            <div key={key}>
              <label className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted">
                {label}
              </label>
              <input
                type="number"
                step="any"
                className={`${input} h-11 w-full`}
                value={sample[key]}
                onChange={(e) => setSample((s) => ({ ...s, [key]: Number(e.target.value) }))}
              />
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-1.5 border-t border-border pt-4 font-mono text-xs text-text-muted">
          {formula.groups.map((g) => (
            <div key={g.id} className="flex justify-between">
              <span>{g.label}</span>
              <span className="text-text">{nf(computeGroupValue(g, stats), 1)}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border border-accent bg-bg px-4 py-3">
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-text-muted">
            Match score (⌈ sum ⌉)
          </span>
          <span className="font-mono text-3xl font-bold tabular-nums text-accent">{nf(score)}</span>
        </div>
        <p className="mt-2 text-[0.65rem] text-text-subtle">
          Recomputes live. Save to apply (affects scores computed from the next ingest onward).
        </p>
      </section>
    </div>
  );
}
