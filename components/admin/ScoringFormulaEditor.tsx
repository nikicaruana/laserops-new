"use client";

/**
 * components/admin/ScoringFormulaEditor.tsx
 * --------------------------------------------------------------------
 * Drag-and-drop builder for the configurable match-score formula. The score is
 * the sum of GROUPS; each group has additive metric blocks and its own
 * multipliers. Blocks are draggable between a group's base/multiplier areas and
 * between groups (moving a block changes its role). A live worked example shows
 * the effect of every change before saving. Persists the whole structure as
 * jsonb to score_formula (admin-write RLS), keyed by game mode.
 *
 * BlockCard / Zone are module-level components (not defined inside the editor)
 * so they keep a stable identity across renders — otherwise every keystroke
 * would remount the inputs and steal focus.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import {
  computeGroupValue,
  computeScore,
  formulaExpression,
  groupExpression,
  FORMULA_STATS,
  type FormulaBlock,
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

/* ---- block card (module-level: stable identity => inputs keep focus) ---- */
function BlockCard({
  block,
  groupId,
  area,
  dragId,
  onDragStart,
  onDragEnd,
  onDropOnBlock,
  onUpdate,
  onRemove,
}: {
  block: FormulaBlock;
  groupId: string;
  area: Area;
  dragId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropOnBlock: (groupId: string, area: Area, blockId: string) => void;
  onUpdate: (id: string, patch: Partial<FormulaBlock>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(block.id)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDropOnBlock(groupId, area, block.id);
      }}
      className={`flex items-center gap-2 border border-border-strong bg-bg px-2 py-1.5 ${
        dragId === block.id ? "opacity-40" : ""
      }`}
    >
      <span className="cursor-grab select-none text-text-subtle" aria-hidden>⠿</span>
      {area === "multipliers" && <span className="font-mono text-xs text-text-subtle">1+</span>}
      <select
        value={block.stat}
        onChange={(e) => onUpdate(block.id, { stat: e.target.value })}
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
        onChange={(e) => onUpdate(block.id, { weight: Number(e.target.value) })}
        onFocus={(e) => e.target.select()}
        className={`${input} w-20`}
      />
      <button
        type="button"
        onClick={() => onRemove(block.id)}
        aria-label="Remove"
        className="flex h-6 w-6 shrink-0 items-center justify-center text-text-subtle hover:text-red-400"
      >
        ✕
      </button>
    </div>
  );
}

/* ---- drop zone (module-level) ---- */
function Zone({
  active,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: {
  active: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className={`min-h-[3rem] space-y-2 border border-dashed p-2 transition-colors ${
        active ? "border-accent bg-accent/5" : "border-border"
      }`}
    >
      {children}
    </div>
  );
}

export function ScoringFormulaEditor({
  initial,
  modeSlug,
}: {
  initial: ScoreFormula;
  modeSlug: string;
}) {
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

  /* ---- drag glue ---- */
  const onDragStart = (id: string) => setDragId(id);
  const onDragEnd = () => {
    setDragId(null);
    setOverZone(null);
  };
  const onDropOnBlock = (groupId: string, area: Area, blockId: string) => {
    if (dragId && dragId !== blockId) moveBlock(dragId, groupId, area, blockId);
    setDragId(null);
    setOverZone(null);
  };
  const dropInZone = (groupId: string, area: Area) => {
    if (dragId) moveBlock(dragId, groupId, area, null);
    setDragId(null);
    setOverZone(null);
  };

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
      .upsert(
        { operator_id: OPERATOR_ID, mode_slug: modeSlug, structure: formula },
        { onConflict: "operator_id,mode_slug" },
      );
    setSaving(false);
    if (err) {
      setError(err.message || "Couldn't save the formula.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  const renderBlocks = (g: { id: string }, area: Area, blocks: FormulaBlock[]) =>
    blocks.map((b) => (
      <BlockCard
        key={b.id}
        block={b}
        groupId={g.id}
        area={area}
        dragId={dragId}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDropOnBlock={onDropOnBlock}
        onUpdate={updateBlock}
        onRemove={removeBlock}
      />
    ));

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

      {/* Live written preview */}
      <section className="border border-border bg-bg-elevated px-5 py-4">
        <h2 className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-text-muted">
          Formula
        </h2>
        <div className="overflow-x-auto">
          <p className="whitespace-nowrap font-mono text-sm text-text">
            score = {formulaExpression(formula)}
          </p>
          {formula.groups.length > 1 && (
            <ul className="mt-2 space-y-1">
              {formula.groups.map((g) => (
                <li key={g.id} className="whitespace-nowrap font-mono text-xs text-text-muted">
                  <span className="text-accent">{g.label || "group"}</span> = {groupExpression(g)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Groups */}
      <div className="space-y-4">
        {formula.groups.map((g, gi) => {
          const value = computeGroupValue(g, stats);
          return (
            <div key={g.id}>
              {gi > 0 && <div className="mb-4 text-center font-mono text-lg text-text-subtle">+</div>}
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
                    <Zone
                      active={overZone === `${g.id}:baseTerms`}
                      onDragOver={() => setOverZone(`${g.id}:baseTerms`)}
                      onDragLeave={() => setOverZone((z) => (z === `${g.id}:baseTerms` ? null : z))}
                      onDrop={() => dropInZone(g.id, "baseTerms")}
                    >
                      {g.baseTerms.length === 0 && (
                        <p className="py-1 text-center text-[0.65rem] text-text-subtle">Drop metrics here</p>
                      )}
                      {renderBlocks(g, "baseTerms", g.baseTerms)}
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
                    <Zone
                      active={overZone === `${g.id}:multipliers`}
                      onDragOver={() => setOverZone(`${g.id}:multipliers`)}
                      onDragLeave={() => setOverZone((z) => (z === `${g.id}:multipliers` ? null : z))}
                      onDrop={() => dropInZone(g.id, "multipliers")}
                    >
                      {g.multipliers.length === 0 && (
                        <p className="py-1 text-center text-[0.65rem] text-text-subtle">
                          No multipliers — base only
                        </p>
                      )}
                      {renderBlocks(g, "multipliers", g.multipliers)}
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
                onFocus={(e) => e.target.select()}
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
