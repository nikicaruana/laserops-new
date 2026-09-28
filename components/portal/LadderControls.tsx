"use client";

/**
 * components/portal/LadderControls.tsx
 * --------------------------------------------------------------------
 * Enrol a squad you manage into a ladder (enroll_squad_in_ladder), and an
 * admin "reseed by roster XP" control (reseed_ladder).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

const select =
  "h-9 rounded-none border border-border bg-bg-overlay px-2 text-xs text-text focus:border-accent focus:outline-none";

export function EnrollLadderButton({ ladderKey, options }: { ladderKey: string; options: { id: string; name: string }[] }) {
  const [squadId, setSquadId] = useState(options[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (options.length === 0) return null;

  async function request() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("request_ladder_join", { p_ladder_key: ladderKey, p_squad_id: squadId });
    setBusy(false);
    if (err) return setError(err.message);
    setRequested(true);
  }

  if (requested) {
    return <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Request sent – awaiting approval.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.length > 1 && (
        <select className={select} value={squadId} onChange={(e) => setSquadId(e.target.value)}>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      )}
      <Button type="button" size="sm" onClick={request} disabled={busy}>
        {busy ? "Sending…" : options.length > 1 ? "Request to join" : `Request to join · ${options[0].name}`}
      </Button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}

export function ReseedLadderButton({ ladderKey }: { ladderKey: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reseed() {
    if (!window.confirm("Reseed the whole ladder by squad-roster XP? This overwrites current positions.")) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("reseed_ladder", { p_ladder_key: ladderKey });
    setBusy(false);
    if (err) return setError(err.message);
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={reseed}
        disabled={busy}
        className="h-9 border border-border-strong px-4 text-xs font-bold uppercase tracking-[0.12em] text-text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {busy ? "Reseeding…" : "Reseed by XP"}
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
