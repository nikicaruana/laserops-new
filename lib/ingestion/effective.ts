/**
 * lib/ingestion/effective.ts
 * --------------------------------------------------------------------
 * Applies the Exploit Control base-trading rules to a parsed round to produce
 * the EFFECTIVE captures/hold that scoring, tables, and accolades all use.
 *
 * Rules (from base_trading_config):
 *  - min_hold_seconds: a capture only COUNTS if the base was held >= this long.
 *    A shorter hold is a throwaway "trade" and is EXCLUDED entirely (no capture,
 *    no hold time, nothing toward accolades) — UNLESS the base BURNS during that
 *    possession (a capture that triggers a burn always counts, however brief).
 *  - recapture_window_seconds: a same-player retake of the same base within this
 *    window of their previous (counting) capture of it is a "recapture" — it
 *    still counts, but is scored at recapture_same_player_points instead of the
 *    normal capture value (discourages farming one base back and forth).
 *
 * Pure + config-driven: the ingestion layer reads the config from the DB and
 * passes it in, so behaviour always follows the admin's Exploit Control settings.
 */
import type { Round } from "@/lib/ingestion/round-parser";

export type EffectiveCaptures = {
  /** Counting captures per player, EXCLUDING recaptures (scored at the normal value). */
  captures: Record<number, number>;
  /** Same-player quick recaptures per player (counted, but scored lower). */
  recaptures: Record<number, number>;
  /** Sub-min-hold non-burn captures per player that were excluded entirely. */
  excludedCaptures: Record<number, number>;
  /** Hold seconds from counting captures only (excludes the dropped trades). */
  holdSeconds: Record<number, number>;
};

function toEpoch(t: string): number {
  const ms = Date.parse(t.replace(/\./g, "-").replace(" ", "T"));
  return Number.isNaN(ms) ? NaN : Math.floor(ms / 1000);
}

export function effectiveCaptures(
  round: Round,
  opts: { minHoldSeconds?: number | null; recaptureWindowSeconds?: number | null },
): EffectiveCaptures {
  const minHold = opts.minHoldSeconds && opts.minHoldSeconds > 0 ? opts.minHoldSeconds : 0;
  const recapWindow = opts.recaptureWindowSeconds && opts.recaptureWindowSeconds > 0 ? opts.recaptureWindowSeconds : 0;

  const captures: Record<number, number> = {};
  const recaptures: Record<number, number> = {};
  const excludedCaptures: Record<number, number> = {};
  const holdSeconds: Record<number, number> = {};
  for (const p of round.players) {
    captures[p.in_game_player_id] = 0;
    recaptures[p.in_game_player_id] = 0;
    excludedCaptures[p.in_game_player_id] = 0;
    holdSeconds[p.in_game_player_id] = 0;
  }

  // Burn moment per base (a capture whose possession contains the burn is exempt
  // from the min-hold rule).
  const burnEpoch: Record<number, number> = {};
  for (const b of round.result.burns) burnEpoch[b.base_id] = b.burn_epoch;

  const periodOf = (base: number, from: string) =>
    round.base_ownership.find((pp) => pp.base_id === base && pp.from_time === from);

  // Counting captures, in time order, so recapture detection sees the prior one.
  type Cap = { pid: number; base: number; t: number; held: number };
  const counting: Cap[] = [];
  for (const cap of round.events.captures) {
    if (cap.capturing_player_id == null || cap.base_id < 0) continue;
    const per = periodOf(cap.base_id, cap.time);
    const held = per ? per.held_seconds : 0;
    const ct = toEpoch(cap.time);
    const toT = per && per.to_time ? toEpoch(per.to_time) : ct + held;
    const burnInPossession = burnEpoch[cap.base_id] != null && burnEpoch[cap.base_id] >= ct - 1 && burnEpoch[cap.base_id] <= toT + 1;
    if (minHold > 0 && held < minHold && !burnInPossession) {
      excludedCaptures[cap.capturing_player_id] = (excludedCaptures[cap.capturing_player_id] ?? 0) + 1;
      continue; // EXCLUDED: any capture held < min_hold_seconds (non-burn) does not count
    }
    counting.push({ pid: cap.capturing_player_id, base: cap.base_id, t: ct, held });
  }
  counting.sort((a, b) => a.t - b.t);

  const lastByKey: Record<string, number> = {}; // `${pid}:${base}` -> last counting capture epoch
  for (const c of counting) {
    holdSeconds[c.pid] = (holdSeconds[c.pid] ?? 0) + c.held;
    const key = `${c.pid}:${c.base}`;
    const prev = lastByKey[key];
    if (recapWindow > 0 && prev != null && c.t - prev <= recapWindow) {
      recaptures[c.pid] = (recaptures[c.pid] ?? 0) + 1;
    } else {
      captures[c.pid] = (captures[c.pid] ?? 0) + 1;
    }
    lastByKey[key] = c.t;
  }

  return { captures, recaptures, excludedCaptures, holdSeconds };
}
