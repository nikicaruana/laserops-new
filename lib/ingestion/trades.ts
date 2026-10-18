/**
 * lib/ingestion/trades.ts
 * --------------------------------------------------------------------
 * Base-trading detection. A "traded" capture is a throwaway: the base was lost
 * again almost immediately, so it was flipped for points rather than held. We
 * key it off the same knob the admin already configures in Exploit control –
 * base_trading_config.min_hold_seconds ("a capture only counts if held >= this")
 * – a capture whose resulting hold fell short of that is a trade.
 *
 * Downstream (commit) uses the same signal to discount/void the capture points;
 * here it just surfaces a per-player count in the ingest preview.
 */
import type { Round } from "@/lib/ingestion/round-parser";

function toEpoch(t: string): number {
  // Force UTC so epochs match across runtimes (server parse vs browser recompute);
  // only epoch differences are used. See effective.ts for the full rationale.
  const iso = t.replace(/\./g, "-").replace(" ", "T");
  const ms = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + "Z");
  return Number.isNaN(ms) ? NaN : Math.floor(ms / 1000);
}

/**
 * Count of traded (short-lived) captures per capturing player.
 * `minHoldSeconds` null/0 -> nothing is a trade (feature off), returns {}.
 */
export function tradedCapsByPlayer(round: Round, minHoldSeconds: number | null | undefined): Record<number, number> {
  const out: Record<number, number> = {};
  if (!minHoldSeconds || minHoldSeconds <= 0) return out;

  for (const cap of round.events.captures) {
    if (cap.capturing_player_id == null) continue;
    // The ownership period this capture opened (same base, starts at capture time).
    const period = round.base_ownership.find(
      (p) => p.base_id === cap.base_id && toEpoch(p.from_time) === toEpoch(cap.time),
    );
    if (period && period.held_seconds < minHoldSeconds) {
      out[cap.capturing_player_id] = (out[cap.capturing_player_id] ?? 0) + 1;
    }
  }
  return out;
}
