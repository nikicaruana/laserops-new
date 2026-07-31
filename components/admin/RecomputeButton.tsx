"use client";

/**
 * components/admin/RecomputeButton.tsx
 * --------------------------------------------------------------------
 * Runs recompute_read_models() (refreshes lifetime stats, period stats, gun
 * stats, ratings, season standings). Use after importing games or editing
 * season/challenge/rating config. Shows the per-table counts on success.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export function RecomputeButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, number> | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    const supabase = createClient();
    const { data, error: err } = await supabase.rpc("recompute_read_models");
    setBusy(false);
    if (err) {
      setError(err.message || "Recompute failed.");
      return;
    }
    setResult((data ?? null) as Record<string, number> | null);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <Button type="button" size="md" onClick={run} disabled={busy}>
          {busy ? "Recomputing…" : "Recompute now"}
        </Button>
        {result && (
          <span className="font-mono text-xs text-text-muted">
            {Object.entries(result).map(([k, v]) => `${k} ${v}`).join(" · ")}
          </span>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
