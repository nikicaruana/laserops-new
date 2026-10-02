/**
 * lib/ingestion/accolades.ts
 * --------------------------------------------------------------------
 * Layer B: compute MATCH accolades (superlatives) from aggregated per-player
 * match stats. Mirrors the seeded `accolade_rules` (rule_type 'match_superlative')
 * in supabase/migrations/20260722155719_seed_accolades.sql. Accolades are XP-only
 * (they do NOT add to score) – see [[match-scorecard-template]].
 *
 * Pure. One winner per accolade (superlative holder), with deterministic
 * tie-breaks. `Specialist` (score max grouped by gun) is omitted here because
 * per-player gun is not present in the round JSON.
 */

export type AccoladeStat = {
  id: number;
  name: string; // "Head NN"
  team: string;
  score: number; // v2 total score (kills + objective + streaks)
  frags: number;
  deaths: number;
  kd: number;
  shots: number;
  hits: number;
  accuracy: number; // fraction 0..1
  wounds: number;
  damage: number;
  captures: number; // counted base captures (incl. recaptures)
  holdSeconds: number; // total seconds bases held
};

import type { AccoladeWin } from "@/lib/match-report-v2/types";
export type { AccoladeWin } from "@/lib/match-report-v2/types";

type Def = { key: string; name: string; stat: keyof AccoladeStat | "apex"; dir: "max" | "min"; tiebreak?: keyof AccoladeStat };

// The 14 JSON-derivable superlatives (Specialist omitted – needs gun) + the two
// objective accolades (CAP-Tain, Fortress). Names match the CMS Accolade_Name.
const DEFS: Def[] = [
  { key: "MVP", name: "MVP", stat: "score", dir: "max" },
  { key: "Reaper", name: "Reaper", stat: "frags", dir: "max" },
  { key: "Kamikaze", name: "Kamikaze", stat: "deaths", dir: "max" },
  { key: "Tank", name: "Tank", stat: "deaths", dir: "min" },
  { key: "Rambo", name: "Rambo", stat: "shots", dir: "max" },
  { key: "Ammo_Saver", name: "Ammo Saver", stat: "shots", dir: "min" },
  { key: "Apex_Predator", name: "Apex Predator", stat: "apex", dir: "max" },
  { key: "Eagle_Eye", name: "Eagle Eye", stat: "accuracy", dir: "max" },
  { key: "Spray_n_Pray", name: "Spray n Pray", stat: "accuracy", dir: "min" },
  { key: "Punisher", name: "Punisher", stat: "hits", dir: "max" },
  { key: "Swiss_Cheese", name: "Swiss Cheese", stat: "wounds", dir: "max" },
  { key: "Ghost", name: "Ghost", stat: "wounds", dir: "min" },
  { key: "Heavy_Hitter", name: "Heavy Hitter", stat: "damage", dir: "max" },
  { key: "Pacifist", name: "Pacifist", stat: "damage", dir: "min" },
  { key: "CAP-Tain", name: "CAP-Tain", stat: "captures", dir: "max", tiebreak: "holdSeconds" },
  { key: "Fortress", name: "Fortress", stat: "holdSeconds", dir: "max" },
];

export function computeAccolades(players: AccoladeStat[]): AccoladeWin[] {
  if (players.length === 0) return [];
  const out: AccoladeWin[] = [];

  for (const def of DEFS) {
    let winner: AccoladeStat | undefined;
    let winVal = 0;

    if (def.stat === "apex") {
      // K/D max: undefeated (0 deaths) rank above everyone; tie-break by frags.
      const sorted = [...players].sort((a, b) => {
        const az = a.deaths === 0 ? 1 : 0, bz = b.deaths === 0 ? 1 : 0;
        if (az !== bz) return bz - az;
        if (b.kd !== a.kd) return b.kd - a.kd;
        return b.frags - a.frags;
      });
      winner = sorted[0];
      winVal = winner?.kd ?? 0;
    } else {
      const stat = def.stat;
      const sorted = [...players].sort((a, b) => {
        const av = a[stat] as number, bv = b[stat] as number;
        if (av !== bv) return def.dir === "max" ? bv - av : av - bv;
        // Optional primary tie-break (e.g. CAP-Tain ties broken by hold time).
        if (def.tiebreak) {
          const at = a[def.tiebreak] as number, bt = b[def.tiebreak] as number;
          if (at !== bt) return bt - at;
        }
        // Deterministic fallback: more frags first, then name.
        if (b.frags !== a.frags) return b.frags - a.frags;
        return a.name.localeCompare(b.name, undefined, { numeric: true });
      });
      winner = sorted[0];
      winVal = winner ? (winner[stat] as number) : 0;
    }

    if (winner) out.push({ key: def.key, name: def.name, winnerId: winner.id, winnerName: winner.name, stat: String(def.stat), value: winVal });
  }
  return out;
}

/**
 * Specialist: the top scorer with each distinct weapon (score max, grouped by
 * gun), one winner per non-empty gun. Computed from aggregates (gun + score),
 * not the round JSON. Ties: more frags, then name. Score must be > 0.
 */
export function specialistWinners(rows: { id: number; gun: string | null; score: number; frags: number; name: string }[]): number[] {
  const byGun = new Map<string, { id: number; score: number; frags: number; name: string }[]>();
  for (const r of rows) {
    const gun = (r.gun ?? "").trim();
    if (!gun) continue;
    const arr = byGun.get(gun) ?? [];
    arr.push({ id: r.id, score: r.score, frags: r.frags, name: r.name });
    byGun.set(gun, arr);
  }
  const winners: number[] = [];
  for (const group of byGun.values()) {
    const w = [...group].sort((a, b) => b.score - a.score || b.frags - a.frags || a.name.localeCompare(b.name, undefined, { numeric: true }))[0];
    if (w && w.score > 0) winners.push(w.id);
  }
  return winners;
}
