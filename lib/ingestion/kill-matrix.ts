/**
 * lib/ingestion/kill-matrix.ts
 * --------------------------------------------------------------------
 * Layer B helper: derive "who killed who", nemesis and favourite-prey from
 * parsed rounds. Pure – consumes round.events.kills (+ damage) only.
 *
 * Spawn-trap kills are still real kills for the matrix (they happened); the
 * caller decides whether to void them for SCORING elsewhere.
 */
import type { Round } from "@/lib/ingestion/round-parser";
import type { PairTally, Nemesis, KillMatrix } from "@/lib/match-report-v2/types";

export type { PairTally, Nemesis, KillMatrix } from "@/lib/match-report-v2/types";

export function buildKillMatrix(rounds: Round[]): KillMatrix {
  // Stable id->name across rounds (ids can shift between rounds, so key by name).
  const names = new Set<string>();
  const rows: Record<string, Record<string, number>> = {};

  for (const round of rounds) {
    const nameOf = new Map<number, string>();
    for (const p of round.players) { nameOf.set(p.in_game_player_id, p.name); names.add(p.name); }
    const teamOf = new Map(round.players.map((p) => [p.in_game_player_id, p.team]));
    for (const k of round.events.kills) {
      const killer = nameOf.get(k.actor_id);
      const victim = nameOf.get(k.victim_id);
      if (!killer || !victim) continue;
      // Ignore friendly fire / self for the rivalry view.
      if (teamOf.get(k.actor_id) === teamOf.get(k.victim_id)) continue;
      (rows[killer] ??= {})[victim] = ((rows[killer] ?? {})[victim] ?? 0) + 1;
    }
  }

  const orderedNames = [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const perPlayer: KillMatrix["perPlayer"] = {};
  for (const name of orderedNames) {
    const killed: PairTally[] = Object.entries(rows[name] ?? {}).map(([n, c]) => ({ name: n, count: c })).sort((a, b) => b.count - a.count);
    const killedBy: PairTally[] = orderedNames
      .map((other) => ({ name: other, count: rows[other]?.[name] ?? 0 }))
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count);
    // Nemesis = biggest rivalry: the opponent this player traded the most kills
    // with, counting BOTH directions (kills for + kills against). Tie-break: more
    // kills against you (the more threatening one), then name for determinism.
    const rivalry = [...new Set([...killed.map((t) => t.name), ...killedBy.map((t) => t.name)])]
      .map((opp) => {
        const killsFor = rows[name]?.[opp] ?? 0;
        const killsAgainst = rows[opp]?.[name] ?? 0;
        return { name: opp, killsFor, killsAgainst, combined: killsFor + killsAgainst };
      })
      .sort((a, b) => b.combined - a.combined || b.killsAgainst - a.killsAgainst || a.name.localeCompare(b.name));
    const top = rivalry[0];
    const nemesis: Nemesis = top && top.combined > 0 ? { name: top.name, killsAgainst: top.killsAgainst, killsFor: top.killsFor } : null;
    perPlayer[name] = { killed, killedBy, nemesis };
  }

  return { names: orderedNames, rows, perPlayer };
}
