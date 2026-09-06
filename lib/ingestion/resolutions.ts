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

/** Per-round resolutions, keyed by ambiguous-group id. */
export type CaptureResolution = {
  /** base_id (string key) -> player_id who captured it. */
  assign: Record<string, number>;
  /** Admin has reviewed this group (even if they kept the detected pairing). */
  reviewed: boolean;
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
