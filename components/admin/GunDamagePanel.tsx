"use client";

/**
 * components/admin/GunDamagePanel.tsx
 * --------------------------------------------------------------------
 * Effective-dated damage editor for one gun. Shows the current damage + the
 * full timeline of damage windows, and lets an admin set a new value from a
 * chosen date onward ("from DD-MM-YYYY onwards") via the set_gun_damage RPC.
 *
 * Why date-scoped: scoring resolves the damage in effect on a game's date
 * (gun_damage_at), so re-tuning damage never rewrites past games – and an
 * admin can retroactively correct a mistake from a specific point only.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export type DamageWindow = {
  id: string;
  damage: number | null;
  effective_from: string; // ISO or "-infinity"
  effective_to: string | null; // ISO or null (current)
  note: string | null;
};

const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";

function fmtDate(value: string | null): string {
  if (value === null) return "now";
  if (value.startsWith("-inf")) return "launch";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function GunDamagePanel({
  gunId,
  currentDamage,
  history,
}: {
  gunId: string;
  currentDamage: number | null;
  history: DamageWindow[];
}) {
  const router = useRouter();
  const [damage, setDamage] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(todayISO());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isBackdated = effectiveFrom < todayISO();

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (damage.trim() === "" || Number.isNaN(Number(damage))) {
      setError("Enter a damage number.");
      return;
    }
    if (!effectiveFrom) {
      setError("Pick an effective-from date.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("set_gun_damage", {
      p_gun_id: gunId,
      p_damage: Number(damage),
      p_effective_from: effectiveFrom, // YYYY-MM-DD -> timestamptz (midnight UTC)
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (err) {
      setError(err.message || "Couldn't update damage.");
      return;
    }
    setDone(true);
    setDamage("");
    setNote("");
    setEffectiveFrom(todayISO());
    router.refresh();
  }

  return (
    <aside className="space-y-5">
      <div className="border border-accent bg-bg-elevated px-5 py-5 text-center">
        <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-text-subtle">
          Current damage
        </p>
        <p className="mt-1 font-mono text-4xl font-bold tabular-nums text-accent">
          {currentDamage ?? "–"}
        </p>
      </div>

      <form onSubmit={apply} className="border border-border bg-bg-elevated px-5 py-5">
        <h3 className="mb-4 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">
          Change damage
        </h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted">
              New damage
            </label>
            <input
              type="number"
              step="any"
              className={input}
              value={damage}
              onChange={(e) => setDamage(e.target.value)}
              placeholder={currentDamage != null ? String(currentDamage) : "e.g. 25"}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted">
              Effective from
            </label>
            <input
              type="date"
              className={input}
              value={effectiveFrom}
              max={todayISO()}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
            <p className="mt-1 text-[0.65rem] text-text-subtle">
              {isBackdated
                ? "Backdated: games from this date onward will re-resolve to the new damage; earlier games are untouched."
                : "Applies from today onward. Past games keep their old damage."}
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted">
              Note <span className="text-text-subtle">(optional)</span>
            </label>
            <input
              className={input}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. balance pass, fixed data entry error"
            />
          </div>

          {error && (
            <p className="border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-400">{error}</p>
          )}
          {done && (
            <p className="border border-accent bg-bg px-3 py-2 text-xs text-accent">Damage updated.</p>
          )}

          <Button type="submit" size="md" disabled={busy} className="w-full">
            {busy ? "Applying…" : "Apply change"}
          </Button>
        </div>
      </form>

      <div className="border border-border bg-bg-elevated px-5 py-5">
        <h3 className="mb-4 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-text-muted">
          Damage timeline
        </h3>
        <ol className="space-y-3">
          {history.map((w, i) => (
            <li
              key={w.id}
              className={`flex items-baseline justify-between gap-3 border-l-2 pl-3 ${
                w.effective_to === null ? "border-accent" : "border-border-strong"
              }`}
            >
              <div className="min-w-0">
                <p className="font-mono text-sm font-bold tabular-nums text-text">
                  {w.damage ?? "–"} dmg
                  {w.effective_to === null && (
                    <span className="ml-2 text-[0.55rem] font-bold uppercase tracking-[0.14em] text-accent">
                      current
                    </span>
                  )}
                </p>
                <p className="text-[0.65rem] text-text-subtle">
                  {fmtDate(w.effective_from)} → {fmtDate(w.effective_to)}
                  {w.note ? ` · ${w.note}` : ""}
                </p>
              </div>
              {i === 0 && history.length > 1 && (
                <span className="shrink-0 text-[0.55rem] uppercase tracking-[0.14em] text-text-subtle/60">
                  latest
                </span>
              )}
            </li>
          ))}
          {history.length === 0 && (
            <li className="text-xs text-text-subtle">No damage history yet.</li>
          )}
        </ol>
      </div>
    </aside>
  );
}
