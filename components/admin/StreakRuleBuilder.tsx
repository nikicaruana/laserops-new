"use client";

/**
 * components/admin/StreakRuleBuilder.tsx
 * --------------------------------------------------------------------
 * Block-based builder for a streak's firing RULE (streak_definitions.rule).
 * Pick a rule kind (the building blocks) + its params; a live plain-English
 * preview shows what it fires on. The data-driven engine
 * (lib/ingestion/streak-engine) evaluates whatever is saved here, so every
 * streak — built-in or custom — is fully configurable. Gated (TOTP).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { TotpGate } from "@/components/admin/TotpGate";
import type { StreakRuleConfig, EventName, Scope } from "@/lib/ingestion/streak-engine";

const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";

const KINDS: { kind: StreakRuleConfig["kind"]; label: string }[] = [
  { kind: "consecutive", label: "N in a row (resets on death)" },
  { kind: "count", label: "N in a round / life" },
  { kind: "distinct", label: "N different things (bases / victims)" },
  { kind: "per_target", label: "N against the same target" },
  { kind: "first_of", label: "First of the round" },
  { kind: "last_of", label: "Last of the round" },
  { kind: "cover_set", label: "Cover everyone (all opponents)" },
  { kind: "victim_streak", label: "Kill someone on a streak" },
  { kind: "combo_window", label: "Combo within a time window" },
  { kind: "hold_duration", label: "Hold a base for N seconds" },
  { kind: "burn", label: "Burn N bases (advanced)" },
  { kind: "survive_round", label: "Survive the round with N kills" },
];

const EVENTS: EventName[] = ["kill", "capture", "death"];

function defaultRule(kind: StreakRuleConfig["kind"]): StreakRuleConfig {
  switch (kind) {
    case "consecutive": return { kind, event: "kill", count: 3, reset_on: ["death"] };
    case "count": return { kind, event: "kill", count: 3, scope: "round" };
    case "distinct": return { kind, event: "capture", count: 2, scope: "life", distinct_by: "base" };
    case "per_target": return { kind, event: "kill", count: 10, scope: "round", target: "victim" };
    case "first_of": return { kind, event: "kill" };
    case "last_of": return { kind, event: "kill" };
    case "cover_set": return { kind, event: "kill", set: "opponents", scope: "round" };
    case "victim_streak": return { kind, event: "kill", min_streak: 5 };
    case "combo_window": return { kind, window_seconds: 30, requirements: [{ event: "kill", count: 2 }, { event: "capture", count: 1 }] };
    case "hold_duration": return { kind, min_seconds: 180 };
    case "burn": return { kind, count: 1 };
    case "survive_round": return { kind, require_event: "kill", require_count: 5 };
  }
}

export function describeRule(r: StreakRuleConfig): string {
  const s = (n: number, scope: Scope) => (scope === "life" ? `${n} in one life` : `${n} in the round`);
  switch (r.kind) {
    case "consecutive": return `Fires each time a player gets ${r.count} ${r.event} in a row (resets on ${r.reset_on.join("/")}).`;
    case "count": return `Fires when a player reaches ${s(r.count, r.scope)} ${r.event}${r.actor_hp_max != null ? ` while on ≤${r.actor_hp_max} HP` : ""}.`;
    case "distinct": return `Fires when a player ${r.event === "capture" ? "captures" : "hits"} ${r.count} different ${r.distinct_by}s ${r.scope === "life" ? "in one life" : "in the round"}.`;
    case "per_target": return `Fires when a player gets ${r.count} ${r.event}s against the same ${r.target} ${r.scope === "life" ? "in one life" : "in the round"}.`;
    case "first_of": return `Fires for the first ${r.event} of the round.`;
    case "last_of": return `Fires for the last ${r.event} of the round.`;
    case "cover_set": return `Fires when a player ${r.event}s every opponent at least once ${r.scope === "life" ? "in one life" : "in the round"}.`;
    case "victim_streak": return `Fires when a player ${r.event}s someone who is on a ${r.min_streak}+ kill streak.`;
    case "combo_window": return `Fires when a player, within ${r.window_seconds}s, gets ${r.requirements.map((q) => `${q.count} ${q.event}${q.count > 1 ? "s" : ""}`).join(" and ")}.`;
    case "hold_duration": return `Fires when a player holds a base continuously for ${Math.round(r.min_seconds / 60)} min (${r.min_seconds}s).`;
    case "burn": return `Fires when a player burns ${r.count} base${r.count > 1 ? "s" : ""} (cumulative 10-min hold). Advanced / provisional.`;
    case "survive_round": return `Fires when a player finishes the round with 0 deaths and ≥${r.require_count} ${r.require_event}s.`;
  }
}

export function StreakRuleBuilder({
  streakId,
  initialRule,
  isBuiltin,
}: {
  streakId: string;
  initialRule: StreakRuleConfig | null;
  isBuiltin: boolean;
}) {
  const router = useRouter();
  const [rule, setRule] = useState<StreakRuleConfig>(initialRule ?? defaultRule("count"));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(false);

  // Loose field update (rule is a discriminated union).
  const upd = (patch: Record<string, unknown>) => {
    setRule((prev) => ({ ...prev, ...patch }) as StreakRuleConfig);
    setSaved(false);
  };
  const num = (v: string, d = 0) => (v.trim() === "" ? d : Number(v));

  async function doSave() {
    setGateOpen(false);
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("streak_definitions").update({ rule }).eq("id", streakId);
    setSaving(false);
    if (err) return setError(err.message);
    setSaved(true);
    router.refresh();
  }

  const eventSelect = (value: string, onChange: (v: EventName) => void, label = "Event") => (
    <div>
      <label className={lbl}>{label}</label>
      <select className={input} value={value} onChange={(e) => onChange(e.target.value as EventName)}>
        {EVENTS.map((ev) => (
          <option key={ev} value={ev}>{ev}</option>
        ))}
      </select>
    </div>
  );
  const scopeSelect = (value: Scope, onChange: (v: Scope) => void) => (
    <div>
      <label className={lbl}>Scope</label>
      <select className={input} value={value} onChange={(e) => onChange(e.target.value as Scope)}>
        <option value="round">Whole round</option>
        <option value="life">One life</option>
      </select>
    </div>
  );
  const numField = (label: string, value: number, key: string, min = 1) => (
    <div>
      <label className={lbl}>{label}</label>
      <input type="number" min={min} className={input} value={value} onChange={(e) => upd({ [key]: num(e.target.value, min) })} onFocus={(e) => e.target.select()} />
    </div>
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); setGateOpen(true); }} className="max-w-2xl">
      <fieldset className="border border-border bg-bg-elevated px-5 py-5">
        <legend className="px-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">
          Firing rule
        </legend>
        <p className="mb-4 text-xs text-text-muted">
          Built from blocks — the ingestion engine evaluates this against the match data.
          {isBuiltin && " This is a built-in streak; you can retune its rule here."}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={lbl}>Rule kind</label>
            <select className={input} value={rule.kind} onChange={(e) => { setRule(defaultRule(e.target.value as StreakRuleConfig["kind"])); setSaved(false); }}>
              {KINDS.map((k) => (
                <option key={k.kind} value={k.kind}>{k.label}</option>
              ))}
            </select>
          </div>

          {(rule.kind === "consecutive" || rule.kind === "count" || rule.kind === "distinct" || rule.kind === "per_target" ||
            rule.kind === "first_of" || rule.kind === "last_of" || rule.kind === "cover_set" || rule.kind === "victim_streak") &&
            eventSelect(rule.event, (v) => upd({ event: v }))}

          {rule.kind === "consecutive" && numField("How many in a row", rule.count, "count")}
          {rule.kind === "count" && (
            <>
              {numField("How many", rule.count, "count")}
              {scopeSelect(rule.scope, (v) => upd({ scope: v }))}
              <div>
                <label className={lbl}>Only while HP ≤ (optional)</label>
                <input type="number" className={input} value={rule.actor_hp_max ?? ""} onChange={(e) => upd({ actor_hp_max: e.target.value === "" ? null : Number(e.target.value) })} placeholder="no HP limit" />
              </div>
            </>
          )}
          {rule.kind === "distinct" && (
            <>
              {numField("How many different", rule.count, "count")}
              {scopeSelect(rule.scope, (v) => upd({ scope: v }))}
              <div>
                <label className={lbl}>Different by</label>
                <select className={input} value={rule.distinct_by} onChange={(e) => upd({ distinct_by: e.target.value })}>
                  <option value="base">Base</option>
                  <option value="victim">Victim</option>
                </select>
              </div>
            </>
          )}
          {rule.kind === "per_target" && (
            <>
              {numField("How many on the same target", rule.count, "count")}
              {scopeSelect(rule.scope, (v) => upd({ scope: v }))}
            </>
          )}
          {(rule.kind === "cover_set") && scopeSelect(rule.scope, (v) => upd({ scope: v }))}
          {rule.kind === "victim_streak" && numField("Victim's streak is at least", rule.min_streak, "min_streak")}
          {rule.kind === "combo_window" && (
            <>
              {numField("Window (seconds)", rule.window_seconds, "window_seconds")}
              <div className="sm:col-span-2">
                <label className={lbl}>Requirements (all within the window)</label>
                <div className="space-y-2">
                  {rule.requirements.map((req, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="number" min={1} className={`${input} w-20`} value={req.count} onChange={(e) => { const r = [...rule.requirements]; r[i] = { ...r[i], count: num(e.target.value, 1) }; upd({ requirements: r }); }} />
                      <select className={input} value={req.event} onChange={(e) => { const r = [...rule.requirements]; r[i] = { ...r[i], event: e.target.value as EventName }; upd({ requirements: r }); }}>
                        {EVENTS.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
                      </select>
                      <button type="button" onClick={() => upd({ requirements: rule.requirements.filter((_, j) => j !== i) })} className="px-2 text-text-subtle hover:text-red-400">×</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => upd({ requirements: [...rule.requirements, { event: "kill", count: 1 }] })} className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-text-subtle hover:text-accent">+ Add requirement</button>
                </div>
              </div>
            </>
          )}
          {rule.kind === "hold_duration" && numField("Hold seconds", rule.min_seconds, "min_seconds", 1)}
          {rule.kind === "burn" && numField("How many bases", rule.count, "count")}
          {rule.kind === "survive_round" && (
            <>
              {eventSelect(rule.require_event, (v) => upd({ require_event: v }), "Require event")}
              {numField("At least this many", rule.require_count, "require_count")}
            </>
          )}
        </div>

        <p className="mt-4 border-l-2 border-accent bg-bg px-3 py-2 text-xs text-text-muted">{describeRule(rule)}</p>

        {error && <p className="mt-3 border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>}
        {saved && <p className="mt-3 border border-accent bg-bg px-4 py-3 text-sm text-accent">Rule saved.</p>}

        <div className="mt-5">
          <Button type="submit" size="md" disabled={saving}>{saving ? "Saving…" : "Save rule"}</Button>
        </div>
      </fieldset>

      <TotpGate open={gateOpen} action="this streak rule" onCancel={() => setGateOpen(false)} onVerified={doSave} />
    </form>
  );
}
