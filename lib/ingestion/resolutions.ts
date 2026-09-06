/**
 * lib/ingestion/resolutions.ts
 * --------------------------------------------------------------------
 * Admin resolutions for parse ambiguities (currently: same-second same-team
 * capture pairings). A resolution assigns each ambiguous base to the player who
 * actually captured it; applying it reassigns those capture events so all
 * downstream scoring (effective captures, hold time, streaks, accolades) follows
 * the admin's choice. Pure.
 */
import type { Round } from "@/lib/ingestion/round-parser";
import { effectiveCaptures, type EffectiveCaptures } from "@/lib/ingestion/effective";

/** Per-round resolutions, keyed by ambiguous-group id. */
export type CaptureResolution = {
  /** base_id (string key) -> player_id who captured it. */
  assign: Record<string, number>;
  /** Admin has reviewed this group (even if they kept the detected pairing). */
  reviewed: boolean;
  /** Split the group's total counted hold time evenly among the players. */
  split?: boolean;
};
export type RoundResolutions = Record<string, CaptureResolution>;

/** True if every ambiguous group in the round has been reviewed by an admin. */
export function allAmbiguitiesReviewed(round: Round, res: RoundResolutions | undefined): boolean {
  const groups = round.ambiguous_captures ?? [];
  if (groups.length === 0) return true;
  return groups.every((g) => res?.[g.id]?.reviewed);
}

export function unreviewedCount(round: Round, res: RoundResolutions | undefined): number {
  return (round.ambiguous_captures ?? []).filter((g) => !res?.[g.id]?.reviewed).length;
}

/**
 * Return a copy of the round with ambiguous captures reassigned per the admin's
 * resolutions. Unresolved groups keep the parser's (arbitrary) pairing. Only the
 * `capturing_player_id` of captures inside a resolved group is changed.
 */
export function resolveRound(round: Round, res: RoundResolutions | undefined): Round {
  const groups = round.ambiguous_captures ?? [];
  if (!res || groups.length === 0) return round;

  // Map (base_id + time) -> assigned player, from every group's assign map.
  const assignByKey = new Map<string, number>();
  for (const g of groups) {
    const r = res[g.id];
    if (!r?.assign) continue;
    for (const [baseIdStr, pid] of Object.entries(r.assign)) {
      if (pid != null) assignByKey.set(`${baseIdStr}|${g.time}`, pid);
    }
  }
  if (assignByKey.size === 0) return round;

  const captures = round.events.captures.map((c) => {
    const key = `${c.base_id}|${c.time}`;
    const pid = assignByKey.get(key);
    return pid != null && c.base_id >= 0 ? { ...c, capturing_player_id: pid } : c;
  });

  return { ...round, events: { ...round.events, captures } };
}

/**
 * Effective captures/hold with admin resolutions applied: assignments reassign
 * captures (and their hold), and any "split" group divides its total counted
 * hold evenly among the tied players. Use this (and pass the returned round to
 * scoring) so the preview + final scoring reflect the admin's decisions.
 */
export function effectiveWithResolutions(
  round: Round,
  opts: { minHoldSeconds?: number | null; recaptureWindowSeconds?: number | null },
  res: RoundResolutions | undefined,
): { round: Round; eff: EffectiveCaptures } {
  const rr = resolveRound(round, res);
  const eff = effectiveCaptures(rr, opts);
  const groups = round.ambiguous_captures ?? [];
  const minHold = opts.minHoldSeconds && opts.minHoldSeconds > 0 ? opts.minHoldSeconds : 0;
  if (!res || groups.length === 0) return { round: rr, eff };

  const holdSeconds = { ...eff.holdSeconds };
  for (const g of groups) {
    const r = res[g.id];
    if (!r?.split) continue;
    const players = g.player_ids;
    if (players.length === 0) continue;
    const assignedOf = (base: number): number => {
      const a = r.assign?.[String(base)];
      if (a != null) return a;
      const cap = round.events.captures.find((c) => c.base_id === base && c.time === g.time);
      return cap?.capturing_player_id ?? players[0];
    };
    // Remove each base's counted hold from whoever currently holds it, then
    // redistribute the group's total evenly (integer seconds, remainder first).
    let total = 0;
    for (const h of g.holds) {
      const counted = minHold > 0 ? (h.held_seconds >= minHold ? h.held_seconds : 0) : h.held_seconds;
      if (counted <= 0) continue;
      total += counted;
      const ap = assignedOf(h.base_id);
      if (holdSeconds[ap] != null) holdSeconds[ap] -= counted;
    }
    const n = players.length;
    const share = Math.floor(total / n);
    const rem = total - share * n;
    players.forEach((p, i) => { holdSeconds[p] = Math.max(0, (holdSeconds[p] ?? 0) + share + (i < rem ? 1 : 0)); });
  }
  return { round: rr, eff: { ...eff, holdSeconds } };
}
