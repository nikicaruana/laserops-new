"use client";

/**
 * components/portal/DeleteMatchButton.tsx
 * --------------------------------------------------------------------
 * Lets the organizer delete a game they created (before it's confirmed). Calls
 * the delete_player_match RPC, which enforces creator + status server-side.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DeleteMatchButton({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function del() {
    if (!window.confirm("Delete this game? Anyone signed up will lose their spot. This can't be undone.")) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("delete_player_match", { p_match_id: matchId });
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    router.push("/player-portal/games");
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={del}
        disabled={busy}
        className="border border-red-800 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-red-400 hover:bg-red-950/40 disabled:opacity-50"
      >
        {busy ? "Deleting…" : "Delete game"}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
