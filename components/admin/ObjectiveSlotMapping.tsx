"use client";

/**
 * components/admin/ObjectiveSlotMapping.tsx
 * --------------------------------------------------------------------
 * Per-mode objective -> rating-slot mapping. The overall rating has two generic
 * "objective play" slots; here each game mode declares which of its objective
 * stats feeds slot 1 and slot 2 (Domination: slot 1 = hold time, slot 2 =
 * captures). Keeping the slots generic lets objective play stay comparable
 * across modes as new modes are added. Writes game_modes.obj_slot{1,2}_stat via
 * the admin session (is_admin RLS). Objective stats come from ONLINE games only.
 */
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** The objective stats a mode can route into a slot. Extend as modes add objectives. */
const OBJ_STATS: { value: string; label: string }[] = [
  { value: "", label: "None" },
  { value: "captures", label: "Captures (count)" },
  { value: "hold_seconds", label: "Hold time (seconds)" },
];

const select =
  "h-9 rounded-none border border-border-strong bg-bg px-3 text-sm text-text focus:border-accent focus:outline-none";

export function ObjectiveSlotMapping({
  modeSlug,
  slot1,
  slot2,
}: {
  modeSlug: string;
  slot1: string | null;
  slot2: string | null;
}) {
  const [s1, setS1] = useState(slot1 ?? "");
  const [s2, setS2] = useState(slot2 ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const supabase = createClient();

  const dirty = s1 !== (slot1 ?? "") || s2 !== (slot2 ?? "");
  const clash = s1 !== "" && s1 === s2;

  async function save() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    const { error } = await supabase
      .from("game_modes")
      .update({ obj_slot1_stat: s1 || null, obj_slot2_stat: s2 || null })
      .eq("slug", modeSlug);
    setBusy(false);
    if (error) setErr(error.message);
    else setMsg("Objective mapping saved.");
  }

  return (
    <section className="mb-8 border border-border bg-bg-elevated px-5 py-4">
      <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-accent">Objective play mapping</h2>
      <p className="mt-1 max-w-2xl text-xs text-text-muted">
        The overall player rating has two generic objective-play slots. Assign each of this
        mode&rsquo;s objectives to a slot so objective performance stays comparable across modes.
        Only <span className="text-text">online-scored</span> games carry objective data.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">Objective play 1</span>
          <select value={s1} onChange={(e) => setS1(e.target.value)} className={select}>
            {OBJ_STATS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">Objective play 2</span>
          <select value={s2} onChange={(e) => setS2(e.target.value)} className={select}>
            {OBJ_STATS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>

      {clash && (
        <p className="mt-3 text-xs text-amber-300">
          Both slots point at the same stat — slot 2 will just mirror slot 1. Pick a different
          objective for each slot.
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty}
          className="border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-bg disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save mapping"}
        </button>
        {msg && <span className="text-xs text-emerald-300">{msg}</span>}
        {err && <span className="text-xs text-red-400">{err}</span>}
      </div>
      <p className="mt-3 text-[0.65rem] text-text-subtle">
        Changing a mapping re-scopes the objective stars on the next rating refresh. The two slot
        weights live in the{" "}
        <a href="/admin/ratings" className="text-accent">Ratings</a> config.
      </p>
    </section>
  );
}
