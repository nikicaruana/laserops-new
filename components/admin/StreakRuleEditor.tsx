"use client";

/**
 * components/admin/StreakRuleEditor.tsx
 * --------------------------------------------------------------------
 * Editor for a streak's firing rule (streak_rules) — how the ingestion engine
 * decides when the streak fires within a round:
 *   - streak:       N consecutive events of one type (breaks on other events)
 *   - time_window:  a count of events within a rolling window of seconds
 *   - first_event:  the first event of a type in the round (First Blood)
 *   - custom:       a JSON params escape hatch
 * Upserts the single rule for this streak via the admin session
 * (streak_rules admin-write RLS). Gated (TOTP). Applies to future games.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { TotpGate } from "@/components/admin/TotpGate";

export type StreakRule = {
  id: string | null;
  rule_type: string; // streak | time_window | first_event | custom
  event_type: string | null;
  event_types: string[] | null;
  breaks_on: string[] | null;
  min_length: number | null;
  window_seconds: number | null;
  min_count: number | null;
  state_condition: string | null;
  params: Record<string, unknown> | null;
};

const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";

const EVENT_HINT = "Event names as they'll appear in the ingested round data (e.g. kill, death, capture).";

const toList = (s: string): string[] =>
  s.split(",").map((x) => x.trim()).filter(Boolean);
const fromList = (a: string[] | null): string => (a ?? []).join(", ");

function plainEnglish(r: StreakRule): string {
  const ev = r.event_type || "event";
  if (r.rule_type === "streak") {
    const brk = (r.breaks_on ?? []).length ? ` (resets on ${fromList(r.breaks_on)})` : "";
    return `Fires each time a player reaches ${r.min_length ?? "?"} ${ev} in a row${brk}.`;
  }
  if (r.rule_type === "time_window") {
    return `Fires when a player records ${r.min_count ?? "?"} of [${fromList(r.event_types)}] within ${
      r.window_seconds ?? "?"
    } seconds${r.state_condition ? `, while ${r.state_condition}` : ""}.`;
  }
  if (r.rule_type === "first_event") {
    return `Fires for the first ${ev} in the round.`;
  }
  return "Custom logic (defined by the JSON params).";
}

export function StreakRuleEditor({
  streakId,
  initialRule,
}: {
  streakId: string;
  initialRule: StreakRule | null;
}) {
  const router = useRouter();
  const [r, setR] = useState<StreakRule>(
    initialRule ?? {
      id: null,
      rule_type: "streak",
      event_type: "kill",
      event_types: [],
      breaks_on: ["death"],
      min_length: 5,
      window_seconds: null,
      min_count: null,
      state_condition: null,
      params: {},
    },
  );
  const [eventTypesText, setEventTypesText] = useState(fromList(initialRule?.event_types ?? []));
  const [breaksOnText, setBreaksOnText] = useState(fromList(initialRule?.breaks_on ?? ["death"]));
  const [paramsText, setParamsText] = useState(JSON.stringify(initialRule?.params ?? {}, null, 2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  function set<K extends keyof StreakRule>(key: K, value: StreakRule[K]) {
    setR((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function buildPayload(): { payload?: Record<string, unknown>; error?: string } {
    const payload: Record<string, unknown> = {
      streak_definition_id: streakId,
      rule_type: r.rule_type,
      event_type: null,
      event_types: null,
      breaks_on: null,
      min_length: null,
      window_seconds: null,
      min_count: null,
      state_condition: null,
      params: {},
    };
    if (r.rule_type === "streak") {
      if (!r.event_type) return { error: "Enter the event that builds the streak." };
      if (!r.min_length) return { error: "Enter how many in a row." };
      payload.event_type = r.event_type;
      payload.min_length = r.min_length;
      payload.breaks_on = toList(breaksOnText);
    } else if (r.rule_type === "time_window") {
      const events = toList(eventTypesText);
      if (!events.length) return { error: "Enter at least one event type." };
      if (!r.window_seconds) return { error: "Enter the window length in seconds." };
      if (!r.min_count) return { error: "Enter how many events are needed." };
      payload.event_types = events;
      payload.window_seconds = r.window_seconds;
      payload.min_count = r.min_count;
      payload.state_condition = r.state_condition || null;
    } else if (r.rule_type === "first_event") {
      if (!r.event_type) return { error: "Enter the event." };
      payload.event_type = r.event_type;
    } else {
      try {
        payload.params = JSON.parse(paramsText || "{}");
      } catch {
        return { error: "Params must be valid JSON." };
      }
    }
    return { payload };
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const { error: verr } = buildPayload();
    if (verr) return setError(verr);
    setGateOpen(true);
  }

  async function doSave() {
    setGateOpen(false);
    const { payload, error: verr } = buildPayload();
    if (verr || !payload) {
      setError(verr ?? "Couldn't build the rule.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const res = r.id
      ? await supabase.from("streak_rules").update(payload).eq("id", r.id).select("id").single()
      : await supabase.from("streak_rules").insert(payload).select("id").single();
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
    <form onSubmit={onSubmit} className="max-w-2xl">
      <fieldset className="border border-border bg-bg-elevated px-5 py-5">
        <legend className="px-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">
          Firing rule
        </legend>
        <p className="mb-4 text-xs text-text-muted">
          When this streak fires during a round. Applies to future games, not past awards.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={lbl}>Rule type</label>
            <select className={input} value={r.rule_type} onChange={(e) => set("rule_type", e.target.value)}>
              <option value="streak">Consecutive streak (N in a row)</option>
              <option value="time_window">Burst (N within a time window)</option>
              <option value="first_event">First of its kind (e.g. First Blood)</option>
              <option value="custom">Custom (JSON)</option>
            </select>
          </div>

          {(r.rule_type === "streak" || r.rule_type === "first_event") && (
            <div>
              <label className={lbl}>Event</label>
              <input className={input} value={r.event_type ?? ""} onChange={(e) => set("event_type", e.target.value)} placeholder="kill" />
              <p className="mt-1 text-[0.65rem] text-text-subtle">{EVENT_HINT}</p>
            </div>
          )}

          {r.rule_type === "streak" && (
            <>
              <div>
                <label className={lbl}>How many in a row</label>
                <input type="number" className={input} value={r.min_length ?? ""} onChange={(e) => set("min_length", e.target.value === "" ? null : Number(e.target.value))} onFocus={(e) => e.target.select()} />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Resets on (comma separated)</label>
                <input className={input} value={breaksOnText} onChange={(e) => { setBreaksOnText(e.target.value); setSaved(false); }} placeholder="death" />
              </div>
            </>
          )}

          {r.rule_type === "time_window" && (
            <>
              <div className="sm:col-span-2">
                <label className={lbl}>Event types (comma separated)</label>
                <input className={input} value={eventTypesText} onChange={(e) => { setEventTypesText(e.target.value); setSaved(false); }} placeholder="kill" />
                <p className="mt-1 text-[0.65rem] text-text-subtle">{EVENT_HINT}</p>
              </div>
              <div>
                <label className={lbl}>Window (seconds)</label>
                <input type="number" className={input} value={r.window_seconds ?? ""} onChange={(e) => set("window_seconds", e.target.value === "" ? null : Number(e.target.value))} onFocus={(e) => e.target.select()} />
              </div>
              <div>
                <label className={lbl}>How many needed</label>
                <input type="number" className={input} value={r.min_count ?? ""} onChange={(e) => set("min_count", e.target.value === "" ? null : Number(e.target.value))} onFocus={(e) => e.target.select()} />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>State condition (optional)</label>
                <input className={input} value={r.state_condition ?? ""} onChange={(e) => set("state_condition", e.target.value)} placeholder="e.g. last_alive" />
              </div>
            </>
          )}

          {r.rule_type === "custom" && (
            <div className="sm:col-span-2">
              <label className={lbl}>Params (JSON)</label>
              <textarea
                className={`${input} h-32 resize-y py-2 font-mono`}
                value={paramsText}
                onChange={(e) => { setParamsText(e.target.value); setSaved(false); }}
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

      <TotpGate
        open={gateOpen}
        action="this streak-rule change"
        onCancel={() => setGateOpen(false)}
        onVerified={doSave}
      />
    </form>
  );
}
