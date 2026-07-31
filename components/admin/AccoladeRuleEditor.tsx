"use client";

/**
 * components/admin/AccoladeRuleEditor.tsx
 * --------------------------------------------------------------------
 * Editor for an accolade's award rule (accolade_rules) — the logic that
 * decides who earns it when a match is ingested:
 *   - match_superlative: the player with the max/min of a stat
 *   - threshold:         any player whose stat meets comparator + value
 *   - custom:            a JSON params escape hatch
 * Upserts the single rule for this accolade via the admin session
 * (accolade_rules admin-write RLS). Applies to future ingested games, not
 * past awards.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export type AccoladeRule = {
  id: string | null;
  rule_type: string; // match_superlative | threshold | custom
  stat_key: string | null;
  direction: string | null; // max | min
  comparator: string | null; // >= > <= < =
  threshold_value: number | null;
  params: Record<string, unknown> | null;
};

const STATS: { key: string; label: string }[] = [
  { key: "score", label: "Score" },
  { key: "frags", label: "Kills" },
  { key: "deaths", label: "Deaths" },
  { key: "hits", label: "Hits landed" },
  { key: "shots", label: "Shots fired" },
  { key: "wounds", label: "Times hit (shots received)" },
  { key: "damage", label: "Damage dealt" },
  { key: "accuracy", label: "Accuracy" },
  { key: "kd", label: "K/D ratio" },
  { key: "match_rating", label: "Match rating" },
];

const COMPARATORS = [">=", ">", "<=", "<", "="];

const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";

function plainEnglish(r: AccoladeRule): string {
  const stat = STATS.find((s) => s.key === r.stat_key)?.label ?? r.stat_key ?? "a stat";
  if (r.rule_type === "match_superlative") {
    return r.direction === "min"
      ? `Awarded to the player with the lowest ${stat} in the match.`
      : `Awarded to the player with the highest ${stat} in the match.`;
  }
  if (r.rule_type === "threshold") {
    return `Awarded to every player whose ${stat} is ${r.comparator ?? "?"} ${
      r.threshold_value ?? "?"
    }.`;
  }
  return "Custom logic (defined by the JSON params).";
}

export function AccoladeRuleEditor({
  accoladeId,
  initialRule,
}: {
  accoladeId: string;
  initialRule: AccoladeRule | null;
}) {
  const router = useRouter();
  const [r, setR] = useState<AccoladeRule>(
    initialRule ?? {
      id: null,
      rule_type: "match_superlative",
      stat_key: "score",
      direction: "max",
      comparator: ">=",
      threshold_value: null,
      params: {},
    },
  );
  const [paramsText, setParamsText] = useState(
    JSON.stringify(initialRule?.params ?? {}, null, 2),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof AccoladeRule>(key: K, value: AccoladeRule[K]) {
    setR((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    // Build a clean payload for the chosen rule type (null out irrelevant cols).
    const payload: Record<string, unknown> = {
      accolade_definition_id: accoladeId,
      rule_type: r.rule_type,
      stat_key: null,
      direction: null,
      comparator: null,
      threshold_value: null,
      params: {},
    };
    if (r.rule_type === "match_superlative") {
      if (!r.stat_key) return setError("Pick a stat.");
      payload.stat_key = r.stat_key;
      payload.direction = r.direction ?? "max";
    } else if (r.rule_type === "threshold") {
      if (!r.stat_key) return setError("Pick a stat.");
      if (r.threshold_value === null || Number.isNaN(r.threshold_value)) {
        return setError("Enter a threshold value.");
      }
      payload.stat_key = r.stat_key;
      payload.comparator = r.comparator ?? ">=";
      payload.threshold_value = r.threshold_value;
    } else {
      try {
        payload.params = JSON.parse(paramsText || "{}");
      } catch {
        return setError("Params must be valid JSON.");
      }
    }

    setSaving(true);
    const supabase = createClient();
    const res = r.id
      ? await supabase.from("accolade_rules").update(payload).eq("id", r.id).select("id").single()
      : await supabase.from("accolade_rules").insert(payload).select("id").single();
    setSaving(false);
    if (res.error || !res.data) {
      setError(res.error?.message || "Couldn't save the rule.");
      return;
    }
    setR((prev) => ({ ...prev, id: res.data.id as string }));
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="max-w-2xl">
      <fieldset className="border border-border bg-bg-elevated px-5 py-5">
        <legend className="px-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">
          Award rule
        </legend>
        <p className="mb-4 text-xs text-text-muted">
          How a winner is chosen when a match is ingested. Applies to future
          games, not past awards.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={lbl}>Rule type</label>
            <select className={input} value={r.rule_type} onChange={(e) => set("rule_type", e.target.value)}>
              <option value="match_superlative">Superlative (most / least of a stat)</option>
              <option value="threshold">Threshold (stat meets a value)</option>
              <option value="custom">Custom (JSON)</option>
            </select>
          </div>

          {r.rule_type !== "custom" && (
            <div>
              <label className={lbl}>Stat</label>
              <select className={input} value={r.stat_key ?? ""} onChange={(e) => set("stat_key", e.target.value)}>
                {STATS.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
          )}

          {r.rule_type === "match_superlative" && (
            <div>
              <label className={lbl}>Winner is the…</label>
              <select className={input} value={r.direction ?? "max"} onChange={(e) => set("direction", e.target.value)}>
                <option value="max">Highest (most)</option>
                <option value="min">Lowest (least / fewest)</option>
              </select>
            </div>
          )}

          {r.rule_type === "threshold" && (
            <>
              <div>
                <label className={lbl}>Comparator</label>
                <select className={input} value={r.comparator ?? ">="} onChange={(e) => set("comparator", e.target.value)}>
                  {COMPARATORS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Value</label>
                <input
                  type="number"
                  step="any"
                  className={input}
                  value={r.threshold_value ?? ""}
                  onChange={(e) => set("threshold_value", e.target.value === "" ? null : Number(e.target.value))}
                />
              </div>
            </>
          )}

          {r.rule_type === "custom" && (
            <div className="sm:col-span-2">
              <label className={lbl}>Params (JSON)</label>
              <textarea
                className={`${input} h-32 resize-y py-2 font-mono`}
                value={paramsText}
                onChange={(e) => {
                  setParamsText(e.target.value);
                  setSaved(false);
                }}
              />
            </div>
          )}
        </div>

        <p className="mt-4 border-l-2 border-accent bg-bg px-3 py-2 text-xs text-text-muted">
          {plainEnglish(r)}
        </p>

        {error && (
          <p className="mt-3 border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>
        )}
        {saved && (
          <p className="mt-3 border border-accent bg-bg px-4 py-3 text-sm text-accent">Rule saved.</p>
        )}

        <div className="mt-5">
          <Button type="submit" size="md" disabled={saving}>
            {saving ? "Saving…" : "Save rule"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
