"use client";

/**
 * components/admin/RecomputeButton.tsx
 * --------------------------------------------------------------------
 * Runs recompute_read_models() (refreshes lifetime stats, period stats, gun
 * stats, ratings, season standings). Use after importing games or editing
 * season/challenge/rating config. Shows the per-table counts on success.
 *
 * The recompute rewrites the stored read-models, but the public leaderboard /
 * Hall of Fame boards are cached (~30-min TTL, "leaderboards" tag), so we also
 * ping /api/admin/revalidate-leaderboards to bust that cache and let the boards
 * show the fresh numbers immediately instead of waiting out the TTL.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TotpGate } from "@/components/admin/TotpGate";
import { createClient } from "@/lib/supabase/client";

export function RecomputeButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, number> | null>(null);
  const [gateOpen, setGateOpen] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    const supabase = createClient();
    const { data, error: err } = await supabase.rpc("recompute_read_models");
    if (err) {
      setBusy(false);
      setError(err.message || "Recompute failed.");
      return;
    }
    // Bust the cached public boards so they show the fresh numbers right away.
    try {
      await fetch("/api/admin/revalidate-leaderboards", { method: "POST" });
    } catch {
      // Non-fatal: the boards still catch up on their own TTL.
    }
    setBusy(false);
    setResult((data ?? null) as Record<string, number> | null);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <Button type="button" size="md" onClick={() => setGateOpen(true)} disabled={busy}>
          {busy ? "Recomputing…" : "Recompute now"}
        </Button>
        {result && (
          <span className="font-mono text-xs text-text-muted">
            {Object.entries(result).map(([k, v]) => `${k} ${v}`).join(" · ")}
          </span>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      <TotpGate
        open={gateOpen}
        action="a read-model recompute"
        onCancel={() => setGateOpen(false)}
        onVerified={async () => {
          setGateOpen(false);
          await run();
        }}
      />
    </div>
  );
}
