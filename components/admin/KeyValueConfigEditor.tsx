"use client";

/**
 * components/admin/KeyValueConfigEditor.tsx
 * --------------------------------------------------------------------
 * Reusable editor for a key/value config table (xp_config, elo_config,
 * rating_config). Each setting is described by a FieldSpec (label, help, input
 * kind); values are edited in local state and saved together via one gated
 * upsert on (operator_id, key). Supports:
 *   - numeric vs text value columns (elo_config.value is text)
 *   - grouped sections
 *   - an optional "these should sum to N" banner (rating component weights)
 * The save is gated behind TOTP (sensitive progression change).
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { TotpGate } from "@/components/admin/TotpGate";

const OPERATOR_ID = "00000000-0000-0000-0000-000000000001";

export type FieldSpec = {
  key: string;
  label: string;
  help?: string;
  kind?: "number" | "text" | "select";
  step?: string;
  options?: { value: string; label: string }[];
  group?: string;
};

const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";

export function KeyValueConfigEditor({
  table,
  columnKind,
  fields,
  initial,
  gateAction,
  weightSum,
  note,
}: {
  table: string;
  columnKind: "numeric" | "text";
  fields: FieldSpec[];
  initial: Record<string, string>;
  gateAction: string;
  weightSum?: { keys: string[]; target: number; label: string };
  note?: string;
}) {
  const router = useRouter();
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const f of fields) seed[f.key] = initial[f.key] ?? "";
    return seed;
  });
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(false);

  function set(key: string, value: string) {
    setVals((prev) => ({ ...prev, [key]: value }));
    setState("idle");
  }

  const weightKeys = useMemo(() => new Set(weightSum?.keys ?? []), [weightSum]);
  const sum = useMemo(() => {
    if (!weightSum) return null;
    return weightSum.keys.reduce((acc, k) => acc + (Number(vals[k]) || 0), 0);
  }, [vals, weightSum]);
  const sumOk = sum === null || Math.abs(sum - weightSum!.target) < 1e-6;
  const pctOf = (key: string): string => {
    if (!weightSum) return "";
    return (((Number(vals[key]) || 0) / weightSum.target) * 100).toFixed(1);
  };

  // Preserve field order but split into groups for rendering.
  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, FieldSpec[]>();
    for (const f of fields) {
      const g = f.group ?? "";
      if (!map.has(g)) {
        map.set(g, []);
        order.push(g);
      }
      map.get(g)!.push(f);
    }
    return order.map((g) => ({ heading: g, items: map.get(g)! }));
  }, [fields]);

  async function doSave() {
    setGateOpen(false);
    setState("saving");
    setError(null);
    const supabase = createClient();
    const rows = fields
      .filter((f) => (vals[f.key] ?? "") !== "")
      .map((f) => ({
        operator_id: OPERATOR_ID,
        key: f.key,
        value: columnKind === "numeric" ? Number(vals[f.key]) : String(vals[f.key]),
      }));
    const { error: err } = await supabase.from(table).upsert(rows, { onConflict: "operator_id,key" });
    if (err) {
      setError(err.message);
      setState("idle");
      return;
    }
    setState("saved");
    router.refresh();
  }

  return (
    <div className="max-w-3xl space-y-6">
      {note && <p className="text-xs text-text-muted">{note}</p>}

      {groups.map((group) => (
        <section key={group.heading || "_"} className="border border-border bg-bg-elevated px-5 py-5">
          {group.heading && (
            <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.12em] text-accent">
              {group.heading}
            </h2>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {group.items.map((f) => {
              const isWeight = weightKeys.has(f.key);
              return (
                <div key={f.key}>
                  <label className={lbl}>{f.label}</label>
                  {f.kind === "select" ? (
                    <select className={input} value={vals[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)}>
                      {(f.options ?? []).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : isWeight ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step={f.step ?? "any"}
                        className={`${input} flex-1`}
                        value={vals[f.key] ?? ""}
                        onChange={(e) => set(f.key, e.target.value)}
                        onFocus={(e) => e.target.select()}
                      />
                      <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums text-text-muted">
                        {pctOf(f.key)}%
                      </span>
                    </div>
                  ) : (
                    <input
                      type={f.kind === "text" ? "text" : "number"}
                      step={f.step ?? "any"}
                      className={input}
                      value={vals[f.key] ?? ""}
                      onChange={(e) => set(f.key, e.target.value)}
                      onFocus={(e) => e.target.select()}
                    />
                  )}
                  {f.help && <p className="mt-1 text-[0.65rem] text-text-subtle">{f.help}</p>}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {weightSum && (
        <div
          className={`border px-4 py-3 ${
            sumOk
              ? "border-border bg-bg-elevated"
              : "border-red-800 bg-red-950/40"
          }`}
        >
          <div className="flex items-baseline justify-between">
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted">
              {weightSum.label} · running total
            </span>
            <span className={`font-mono text-lg tabular-nums ${sumOk ? "text-accent" : "text-red-400"}`}>
              {sum?.toFixed(4)}
              <span className="ml-1 text-xs text-text-subtle">/ {weightSum.target}</span>
              <span className="ml-2 text-sm">({((sum ?? 0) / weightSum.target * 100).toFixed(1)}%)</span>
            </span>
          </div>
          {!sumOk && (
            <p className="mt-2 text-xs text-red-400">
              Weights must total {weightSum.target} ({(weightSum.target * 100).toFixed(0)}%). Currently
              off by {((sum ?? 0) - weightSum.target).toFixed(4)}. Saving is blocked until this
              balances.
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      <div className="flex items-center gap-4">
        <Button
          type="button"
          size="md"
          onClick={() => {
            if (!sumOk) {
              setError(`Component weights must total ${weightSum!.target} before saving.`);
              return;
            }
            setError(null);
            setGateOpen(true);
          }}
          disabled={state === "saving" || !sumOk}
        >
          {state === "saving" ? "Saving…" : "Save changes"}
        </Button>
        {state === "saved" && <span className="text-xs text-accent">Saved.</span>}
      </div>

      <TotpGate
        open={gateOpen}
        action={gateAction}
        onCancel={() => setGateOpen(false)}
        onVerified={doSave}
      />
    </div>
  );
}
