"use client";

/**
 * components/admin/LadderResultActions.tsx
 * --------------------------------------------------------------------
 * Records a ladder match result as the winning TEAM COLOUR. record_ladder_result
 * sets the match's winning_team_colour, and a DB trigger derives the winning
 * squad from the assigned squad colours, completes the match, stamps both idle
 * clocks, and swaps ladder positions on an upset. The same colour->movement path
 * runs automatically when ingestion sets the winning team, so no manual pick is
 * needed there. Requires the squads' team colours to be assigned first.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const btn = "border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98] disabled:opacity-50";
const btnAlt = "border border-border-strong px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-text-muted hover:border-accent hover:text-accent disabled:opacity-50";

export function LadderResultActions({
  matchId,
  homeSquadId,
  homeName,
  homeColour,
  awaySquadId,
  awayName,
  awayColour,
  winnerSquadId,
}: {
  matchId: string;
  homeSquadId: string;
  homeName: string;
  homeColour: string | null;
  awaySquadId: string;
  awayName: string;
  awayColour: string | null;
  winnerSquadId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function record(colour: string, label: string) {
    if (!window.confirm(`Record ${label} (${colour}) as the winner? This completes the match and updates ladder positions.`)) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("record_ladder_result", { p_match_id: matchId, p_winning_colour: colour });
    setBusy(false);
    if (err) return setError(err.message);
    router.refresh();
  }

  if (winnerSquadId) {
    const name = winnerSquadId === homeSquadId ? homeName : winnerSquadId === awaySquadId ? awayName : "a squad";
    return (
      <div className="border border-border bg-bg-elevated px-4 py-3">
        <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-muted">Ladder result</p>
        <p className="mt-1 text-sm font-bold text-text">Winner: <span className="text-accent">{name}</span></p>
      </div>
    );
  }

  return (
    <div className="border border-border bg-bg-elevated px-4 py-4">
      <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-muted">Ladder match – record the winning team</p>
      <p className="mt-1 mb-3 text-xs text-text-subtle">Sets the winning team colour and moves ladder positions (the lower squad swaps up if it won). Ingestion will set this automatically once it lands.</p>
      {!homeColour || !awayColour ? (
        <p className="text-xs text-amber-300">Assign both squads a team colour above before recording the result.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={btn} disabled={busy} onClick={() => record(homeColour, homeName)}>{homeName} won ({homeColour})</button>
          <button type="button" className={btnAlt} disabled={busy} onClick={() => record(awayColour, awayName)}>{awayName} won ({awayColour})</button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
