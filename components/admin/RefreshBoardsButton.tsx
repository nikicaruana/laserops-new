"use client";

/**
 * components/admin/RefreshBoardsButton.tsx
 * --------------------------------------------------------------------
 * Busts the cached public leaderboard / Hall of Fame boards on demand, without
 * running a full recompute. The boards read anon-only read-models through a
 * cookieless public client, so their pages are statically generated + cached
 * (unstable_cache, "leaderboards"/"sheets" tags); a DB-side fix (e.g. a view
 * change) does not show until that cache is revalidated on publish/recompute or
 * a redeploy. This is the light manual lever for that: admin-only, no 2FA, no
 * recompute. Pings the same /api/admin/revalidate-leaderboards endpoint the
 * Recompute button uses.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function RefreshBoardsButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch("/api/admin/revalidate-leaderboards", { method: "POST" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Refresh failed.");
      }
      setDone(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" size="md" onClick={run} disabled={busy}>
          {busy ? "Refreshing…" : "Refresh public boards"}
        </Button>
        {done && <span className="text-xs text-text-muted">Boards refreshed.</span>}
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
