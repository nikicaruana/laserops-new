"use client";

/**
 * components/admin/ScoringFormulaEditor.tsx
 * --------------------------------------------------------------------
 * Editor for the match score formula weights (score_formula_config). The
 * formula SHAPE is fixed; only the weights are tunable:
 *
 *   score = ceil( (frags·KILL + damage·DMG + captures·CAP + hold·CAPTIME)
 *                 · (1 + accuracy·ACC) · (1 + kd·KD) )
 *   where damage = hits · gun_damage.
 *
 * Weights are never shown as a bare list — a live worked example against an
 * editable sample player recomputes as you change any weight (or sample stat),
 * so the effect is visible before saving. Writes back via the admin session
 * (score_formula_config admin-write RLS).
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export type WeightRow = { key: string; value: number | null; note: string | null };

const BASE_TERMS = [
  { key: "KILL_WEIGHT", label: "Kills", stat: "frags" as const },
  { key: "DAMAGE_WEIGHT", label: "Damage", stat: "damage" as const },
  { key: "CAPTURE_WEIGHT", label: "Captures", stat: "captures" as const },
  { key: "CAPTURE_TIME_WEIGHT", label: "Hold time", stat: "hold" as const },
];
const MULTIPLIERS = [
  { key: "ACCURACY_WEIGHT", label: "Accuracy", stat: "accuracy" as const },
  { key: "KD_WEIGHT", label: "K/D", stat: "kd" as const },
];

const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text focus:border-accent focus:outline-none";
const lbl = "mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";
const nf = (n: number, d = 0) =>
  n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: 0 });

type Sample = {
  frags: number;
  hits: number;
  gunDamage: number;
  captures: number;
  hold: number;
  accuracyPct: number;
  kd: number;
};

export function ScoringFormulaEditor({ rows }: { rows: WeightRow[] }) {
  const router = useRouter();

  const noteByKey = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of rows) m[r.key] = r.note ?? "";
    return m;
  }, [rows]);

  const [w, setW] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const r of rows) m[r.key] = r.value ?? 0;
    return m;
  });
  const [sample, setSample] = useState<Sample>({
    frags: 30,
    hits: 200,
    gunDamage: 25,
    captures: 0,
    hold: 0,
    accuracyPct: 22,
    kd: 1.29,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const val = (k: string) => w[k] ?? 0;
  const setWeight = (k: string, v: number) => {
    setW((prev) => ({ ...prev, [k]: v }));
    setSaved(false);
  };
  const setStat = (k: keyof Sample, v: number) => setSample((prev) => ({ ...prev, [k]: v }));

  // Live computation.
  const calc = useMemo(() => {
    const damage = sample.hits * sample.gunDamage;
    const stat: Record<string, number> = {
      frags: sample.frags,
      damage,
      captures: sample.captures,
      hold: sample.hold,
      accuracy: sample.accuracyPct / 100,
      kd: sample.kd,
    };
    const baseParts = BASE_TERMS.map((t) => ({
      ...t,
      contribution: stat[t.stat] * val(t.key),
      statValue: stat[t.stat],
    }));
    const base = baseParts.reduce((s, p) => s + p.contribution, 0);
    const accMult = 1 + stat.accuracy * val("ACCURACY_WEIGHT");
    const kdMult = 1 + stat.kd * val("KD_WEIGHT");
    const raw = base * accMult * kdMult;
    const score = Math.ceil(raw);
    return { damage, baseParts, base, accMult, kdMult, raw, score };
  }, [w, sample]);

  async function save() {
    setError(null);
    setSaved(false);
    setSaving(true);
    const supabase = createClient();
    const results = await Promise.all(
      Object.entries(w).map(([key, value]) =>
        supabase.from("score_formula_config").update({ value }).eq("key", key),
      ),
    );
    setSaving(false);
    const firstErr = results.find((r) => r.error)?.error;
    if (firstErr) {
      setError(firstErr.message || "Couldn't save weights.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,20rem)_1fr]">
      {/* Weights */}
      <div className="space-y-5">
        <section className="border border-border bg-bg-elevated px-5 py-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.12em] text-accent">Weights</h2>
          <div className="space-y-4">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-text-subtle">Base terms</p>
            {BASE_TERMS.map((t) => (
              <div key={t.key}>
                <label className={lbl}>{t.label}</label>
                <input
                  type="number"
                  step="any"
                  className={input}
                  value={val(t.key)}
                  onChange={(e) => setWeight(t.key, Number(e.target.value))}
                />
                {noteByKey[t.key] && <p className="mt-1 text-[0.65rem] text-text-subtle">{noteByKey[t.key]}</p>}
              </div>
            ))}
            <p className="pt-2 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-text-subtle">Multipliers</p>
            {MULTIPLIERS.map((t) => (
              <div key={t.key}>
                <label className={lbl}>{t.label}</label>
                <input
                  type="number"
                  step="any"
                  className={input}
                  value={val(t.key)}
                  onChange={(e) => setWeight(t.key, Number(e.target.value))}
                />
                {noteByKey[t.key] && <p className="mt-1 text-[0.65rem] text-text-subtle">{noteByKey[t.key]}</p>}
              </div>
            ))}
          </div>

          {error && (
            <p className="mt-4 border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-400">{error}</p>
          )}
          {saved && (
            <p className="mt-4 border border-accent bg-bg px-3 py-2 text-xs text-accent">Weights saved.</p>
          )}
          <div className="mt-5">
            <Button type="button" size="md" onClick={save} disabled={saving} className="w-full">
              {saving ? "Saving…" : "Save weights"}
            </Button>
          </div>
        </section>
      </div>

      {/* Live preview */}
      <div className="space-y-5">
        {/* Formula with current weights substituted */}
        <section className="border border-border bg-bg-elevated px-5 py-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.12em] text-accent">Formula</h2>
          <div className="overflow-x-auto">
            <p className="whitespace-nowrap font-mono text-sm text-text">
              score = ⌈ ( frags×<b className="text-accent">{val("KILL_WEIGHT")}</b> + damage×
              <b className="text-accent">{val("DAMAGE_WEIGHT")}</b> + captures×
              <b className="text-accent">{val("CAPTURE_WEIGHT")}</b> + hold×
              <b className="text-accent">{val("CAPTURE_TIME_WEIGHT")}</b> ) × (1 + accuracy×
              <b className="text-accent">{val("ACCURACY_WEIGHT")}</b>) × (1 + kd×
              <b className="text-accent">{val("KD_WEIGHT")}</b>) ⌉
            </p>
          </div>
          <p className="mt-2 text-[0.65rem] text-text-subtle">
            damage = hits × gun damage. Accuracy is a 0–1 fraction. ⌈ ⌉ rounds up.
          </p>
        </section>

        {/* Worked example */}
        <section className="border border-accent/40 bg-bg-elevated px-5 py-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.12em] text-accent">
            Worked example
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                <label className={lbl}>{label}</label>
                <input
                  type="number"
                  step="any"
                  className={input}
                  value={sample[key]}
                  onChange={(e) => setStat(key, Number(e.target.value))}
                />
              </div>
            ))}
          </div>

          {/* Breakdown */}
          <div className="mt-5 space-y-1.5 border-t border-border pt-4 font-mono text-xs text-text-muted">
            <div className="flex justify-between">
              <span>damage = {nf(sample.hits)} hits × {nf(sample.gunDamage)} dmg</span>
              <span className="text-text">{nf(calc.damage)}</span>
            </div>
            {calc.baseParts.map((p) => (
              <div key={p.key} className="flex justify-between">
                <span>
                  {p.label.toLowerCase()} = {nf(p.statValue, 2)} × {val(p.key)}
                </span>
                <span className="text-text">{nf(p.contribution, 1)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-border/60 pt-1.5 font-semibold">
              <span>base total</span>
              <span className="text-text">{nf(calc.base, 1)}</span>
            </div>
            <div className="flex justify-between">
              <span>× accuracy (1 + {(sample.accuracyPct / 100).toFixed(2)}×{val("ACCURACY_WEIGHT")})</span>
              <span className="text-text">×{calc.accMult.toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span>× k/d (1 + {sample.kd}×{val("KD_WEIGHT")})</span>
              <span className="text-text">×{calc.kdMult.toFixed(4)}</span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border border-accent bg-bg px-4 py-3">
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-text-muted">
              Match score
            </span>
            <span className="font-mono text-3xl font-bold tabular-nums text-accent">
              {nf(calc.score)}
            </span>
          </div>
          <p className="mt-2 text-[0.65rem] text-text-subtle">
            Recomputes live as you edit any weight or sample stat. Save to apply the weights
            (affects scores computed from the next ingest onward).
          </p>
        </section>
      </div>
    </div>
  );
}
