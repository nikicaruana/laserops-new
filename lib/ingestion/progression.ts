/**
 * lib/ingestion/progression.ts
 * --------------------------------------------------------------------
 * Recompute the per-match XP / level / Elo progression columns on
 * match_player_aggregate. All three are SEQUENTIAL across an account's match
 * history (and Elo also depends on who else was in each match), so we replay
 * every scored match in chronological order, carrying a running XP total and
 * running Elo per account, and back-fill each aggregate row.
 *
 * Runs after a publish and after a "recompute" (post-edit). Rows with no
 * account (unassigned walk-ins) are treated as their own one-match chain.
 * The caller rebuilds the lifetime read-models (recompute_read_models) after.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseEloConfig, computeMatchElo, type EloRow } from "@/lib/scoring/elo";

type Rank = { level: number; threshold: number };
type Agg = {
  id: string; match_id: string; account_id: string | null;
  team_colour: string | null; score: number | null; xp_total: number | null;
  rounds_won: number | null; rounds_lost: number | null;
};
type MatchRow = { id: string; played_on: string | null; scheduled_at: string | null; created_at: string | null; sequence_no: number | null };

const levelForXp = (ranks: Rank[], xp: number) => {
  let lvl = 1;
  for (const r of ranks) if (r.threshold <= xp) lvl = Math.max(lvl, r.level);
  return lvl;
};
const thresholdOf = (ranks: Rank[], level: number) => ranks.find((r) => r.level === level)?.threshold ?? null;

export async function recomputeProgression(client: SupabaseClient): Promise<{ matches: number; rows: number }> {
  const [{ data: cfgRows }, { data: rankRows }, { data: matchRows }, { data: aggRows }] = await Promise.all([
    client.from("elo_config").select("key, value"),
    client.from("rank_levels").select("level, score_threshold").order("level"),
    client.from("matches").select("id, played_on, scheduled_at, created_at, sequence_no"),
    client.from("match_player_aggregate").select("id, match_id, account_id, team_colour, score, xp_total, rounds_won, rounds_lost"),
  ]);

  const params = parseEloConfig((cfgRows ?? []) as { key: string; value: string | null }[]);
  const ranks: Rank[] = ((rankRows ?? []) as { level: number; score_threshold: number | null }[]).map((r) => ({ level: r.level, threshold: r.score_threshold ?? 0 }));

  const byMatch = new Map<string, Agg[]>();
  for (const a of (aggRows ?? []) as Agg[]) (byMatch.get(a.match_id) ?? byMatch.set(a.match_id, []).get(a.match_id)!).push(a);

  // Only matches that actually have players, in chronological order.
  const sortKey = (m: MatchRow) => (m.played_on || m.scheduled_at?.slice(0, 10) || m.created_at?.slice(0, 10) || "1970-01-01");
  const matches = ((matchRows ?? []) as MatchRow[])
    .filter((m) => byMatch.has(m.id))
    .sort((a, b) => sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : (a.sequence_no ?? 0) - (b.sequence_no ?? 0));

  const runningXp = new Map<string, number>();
  const runningElo = new Map<string, number>();
  const updates: Record<string, unknown>[] = [];

  for (const m of matches) {
    const rows = byMatch.get(m.id)!;

    // Elo: seed each row with its account's running Elo (start Elo for walk-ins).
    const eloRows: EloRow[] = rows.map((a) => ({
      id: a.id, team: a.team_colour ?? "", score: a.score ?? 0,
      elo: a.account_id ? (runningElo.get(a.account_id) ?? params.startElo) : params.startElo,
      roundsWon: a.rounds_won ?? 0, roundsLost: a.rounds_lost ?? 0,
    }));
    const elo = computeMatchElo(params, eloRows);

    for (const a of rows) {
      // XP / level: running total per account (each walk-in row is its own chain).
      const key = a.account_id;
      const xpBefore = key ? (runningXp.get(key) ?? 0) : 0;
      const xpAfter = xpBefore + (a.xp_total ?? 0);
      if (key) runningXp.set(key, xpAfter);
      const levelBefore = levelForXp(ranks, xpBefore);
      const levelAfter = levelForXp(ranks, xpAfter);
      const minBefore = thresholdOf(ranks, levelBefore);
      const nextMin = thresholdOf(ranks, levelBefore + 1);
      const span = nextMin != null && minBefore != null ? nextMin - minBefore : 0;
      const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

      const e = elo.get(a.id)!;
      if (key) runningElo.set(key, e.after);

      updates.push({
        id: a.id,
        xp_total_before_match: xpBefore,
        xp_total_after_match: xpAfter,
        level_before: levelBefore,
        level_after: levelAfter,
        xp_level_min_before_match: minBefore,
        xp_next_level_min_before_match: nextMin,
        xp_level_progress_start: span > 0 && minBefore != null ? clamp01((xpBefore - minBefore) / span) : 1,
        xp_level_progress_end: levelAfter > levelBefore || span <= 0 || minBefore == null ? 1 : clamp01((xpAfter - minBefore) / span),
        xp_level_up_in_match: levelAfter > levelBefore,
        elo_before: e.before,
        elo_change: e.change,
        elo_after: e.after,
      });
    }
  }

  if (updates.length) {
    const { error } = await client.rpc("apply_match_progression", { rows: updates });
    if (error) throw new Error(`apply_match_progression failed: ${error.message}`);
  }
  return { matches: matches.length, rows: updates.length };
}
