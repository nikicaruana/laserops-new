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
import { computeMatchXp, parseXpConfig } from "@/lib/scoring/xp";

type Rank = { level: number; threshold: number };
type Agg = {
  id: string; match_id: string; account_id: string | null;
  team_colour: string | null; score: number | null; xp_total: number | null;
  rounds_won: number | null; rounds_lost: number | null; rounds_played: number | null; rounds_won_present: number | null;
  was_winner: boolean | null; xp_from_accolades: number | null; xp_multiplier: number | null;
  xp_total_after_match: number | null; elo_after: number | null;
};
type MatchRow = { id: string; played_on: string | null; scheduled_at: string | null; created_at: string | null; sequence_no: number | null; is_double_xp: boolean | null; round_count: number | null };

const levelForXp = (ranks: Rank[], xp: number) => {
  let lvl = 1;
  for (const r of ranks) if (r.threshold <= xp) lvl = Math.max(lvl, r.level);
  return lvl;
};
const thresholdOf = (ranks: Rank[], level: number) => ranks.find((r) => r.level === level)?.threshold ?? null;

export async function recomputeProgression(client: SupabaseClient, fromMatchId?: string): Promise<{ matches: number; rows: number }> {
  const [{ data: cfgRows }, { data: xpCfgRows }, { data: rankRows }, { data: matchRows }, { data: aggRows }] = await Promise.all([
    client.from("elo_config").select("key, value"),
    client.from("xp_config").select("key, value"),
    client.from("rank_levels").select("level, score_threshold").order("level"),
    client.from("matches").select("id, played_on, scheduled_at, created_at, sequence_no, is_double_xp, round_count"),
    client.from("match_player_aggregate").select("id, match_id, account_id, team_colour, score, xp_total, rounds_won, rounds_lost, rounds_played, rounds_won_present, was_winner, xp_from_accolades, xp_multiplier, xp_total_after_match, elo_after"),
  ]);

  const params = parseEloConfig((cfgRows ?? []) as { key: string; value: string | null }[]);
  const xpCfg = parseXpConfig((xpCfgRows ?? []) as { key: string; value: number | null }[]);
  const ranks: Rank[] = ((rankRows ?? []) as { level: number; score_threshold: number | null }[]).map((r) => ({ level: r.level, threshold: r.score_threshold ?? 0 }));

  const byMatch = new Map<string, Agg[]>();
  for (const a of (aggRows ?? []) as Agg[]) (byMatch.get(a.match_id) ?? byMatch.set(a.match_id, []).get(a.match_id)!).push(a);

  // Only matches that actually have players, in chronological order.
  const sortKey = (m: MatchRow) => (m.played_on || m.scheduled_at?.slice(0, 10) || m.created_at?.slice(0, 10) || "1970-01-01");
  const matches = ((matchRows ?? []) as MatchRow[])
    .filter((m) => byMatch.has(m.id))
    .sort((a, b) => sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : (a.sequence_no ?? 0) - (b.sequence_no ?? 0));

  // Incremental: when a specific match changed (published/edited), replay only
  // from THAT match onward. Everything before it is unchanged, so fast-forward
  // the running XP/Elo from stored results instead of re-scoring it. A full
  // recompute (e.g. an XP/level/Elo config change) passes no fromMatchId.
  const startIndex = fromMatchId ? Math.max(0, matches.findIndex((mm) => mm.id === fromMatchId)) : 0;

  const runningXp = new Map<string, number>();
  const runningElo = new Map<string, number>();
  const updates: Record<string, unknown>[] = [];

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const rows = byMatch.get(m.id)!;

    // Untouched earlier matches: carry each account's running state forward from
    // its stored results — no re-score, no write.
    if (i < startIndex) {
      for (const a of rows) {
        if (!a.account_id) continue;
        runningXp.set(a.account_id, a.xp_total_after_match ?? runningXp.get(a.account_id) ?? 0);
        runningElo.set(a.account_id, a.elo_after ?? runningElo.get(a.account_id) ?? params.startElo);
      }
      continue;
    }

    // Elo: seed each row with its account's running Elo (start Elo for walk-ins).
    const eloRows: EloRow[] = rows.map((a) => ({
      id: a.id, team: a.team_colour ?? "", score: a.score ?? 0,
      elo: a.account_id ? (runningElo.get(a.account_id) ?? params.startElo) : params.startElo,
      roundsWon: a.rounds_won ?? 0, roundsLost: a.rounds_lost ?? 0,
    }));
    const elo = computeMatchElo(params, eloRows);
    const matchAvg = rows.length ? rows.reduce((s, a) => s + (a.score ?? 0), 0) / rows.length : 0;
    // Full-match-equivalent basis for match_rating only (partial players extrapolated).
    const Rp = m.round_count ?? rows.length;
    const ratingBasis = (a: Agg) => { const rp = a.rounds_played && a.rounds_played > 0 ? a.rounds_played : Rp; return rp > 0 ? ((a.score ?? 0) * Rp) / rp : (a.score ?? 0); };
    const avgRatingP = rows.length ? rows.reduce((s, a) => s + ratingBasis(a), 0) / rows.length : 0;

    for (const a of rows) {
      // XP / level: running total per account (each walk-in row is its own chain).
      const key = a.account_id;
      const xpBefore = key ? (runningXp.get(key) ?? 0) : 0;
      const rating = matchAvg > 0 ? (a.score ?? 0) / matchAvg : 0;
      const ratingScoreA = ratingBasis(a);
      const xpb = computeMatchXp({ rating, roundsWon: a.rounds_won_present ?? a.rounds_won ?? 0, isWinner: !!a.was_winner, accoladeXp: a.xp_from_accolades ?? 0, multiplier: Math.max(a.xp_multiplier ?? 1, m.is_double_xp ? 2 : 1) }, xpCfg);
      const xpAfter = xpBefore + xpb.xpTotal;
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
        xp_from_points: xpb.xpFromPoints,
        xp_from_wins: xpb.xpFromWins,
        xp_from_accolades: xpb.xpFromAccolades,
        xp_total: xpb.xpTotal,
        match_rating: avgRatingP > 0 ? Math.round((ratingScoreA / avgRatingP) * 100) / 100 : 0,
        match_average_score: Math.round(matchAvg),
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

  // Stamp every match whose Elo we just (re)computed so the Match Manager shows
  // "Elo calculated" instead of "pending", and clear any stale flag (the results
  // are now current). Covers the published/edited match AND all later matches
  // whose ratings shifted. matches_admin_all RLS lets the admin session do this.
  const processedIds = matches.slice(startIndex).map((m) => m.id);
  if (processedIds.length) {
    const { error: stampErr } = await client
      .from("matches")
      .update({ elo_calculated_at: new Date().toISOString(), results_stale_at: null })
      .in("id", processedIds);
    if (stampErr) throw new Error(`elo_calculated_at stamp failed: ${stampErr.message}`);
  }
  return { matches: matches.length - startIndex, rows: updates.length };
}
