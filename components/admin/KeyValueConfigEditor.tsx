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

  const sum = useMemo(() => {
    if (!weightSum) return null;
    return weightSum.keys.reduce((acc, k) => acc + (Number(vals[k]) || 0), 0);
  }, [vals, weightSum]);
  const sumOk = sum === null || Math.abs(sum - weightSum!.target) < 1e-6;

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
            {group.items.map((f) => (
              <div key={f.key}>
                <label className={lbl}>{f.label}</label>
                {f.kind === "select" ? (
                  <select className={input} value={vals[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)}>
                    {(f.options ?? []).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
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
            ))}
          </div>
        </section>
      ))}

      {weightSum && (
        <p
          className={`border-l-2 px-3 py-2 text-xs ${
            sumOk
              ? "border-accent bg-bg text-text-muted"
              : "border-amber-500 bg-amber-950/30 text-amber-300"
          }`}
        >
          {weightSum.label}: {sum?.toFixed(4)} / {weightSum.target}.{" "}
          {sumOk ? "Balanced." : `Off by ${(sum! - weightSum.target).toFixed(4)} — ratings will be skewed until this sums to ${weightSum.target}.`}
        </p>
      )}

      {error && (
        <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      <div className="flex items-center gap-4">
        <Button
          type="button"
          size="md"
          onClick={() => {
            setError(null);
            setGateOpen(true);
          }}
          disabled={state === "saving"}
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
