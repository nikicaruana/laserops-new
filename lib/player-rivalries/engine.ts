/**
 * lib/player-rivalries/engine.ts
 * --------------------------------------------------------------------
 * All-time head-to-head rivalries for one player: who they kill most
 * (Favourite Prey), who kills them most (Nemesis), and a per-opponent table of
 * kills-for / kills-against / net.
 *
 * DATA SOURCE: per-opponent kills are produced by ingestion (head-to-head tallies
 * per match, aggregated across all matches). That aggregate does not exist yet, so
 * getPlayerRivalries returns an empty result for now and the Rivalries tab shows a
 * graceful empty state. When ingestion lands, populate `opponents` from the
 * aggregate and the rest (nemesis / favourite prey / badges) derives here.
 */
import type { createClient } from "@/lib/supabase/server";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export type RivalBadge = "bully" | "victim" | "even" | null;

export type RivalStat = {
  opsTag: string;
  profilePicUrl: string | null;
  /** Times this player killed the opponent (all-time). */
  killsFor: number;
  /** Times the opponent killed this player (all-time). */
  killsAgainst: number;
  /** killsFor - killsAgainst (calculated). */
  net: number;
  /** Matches the two have faced each other in. */
  encounters: number;
  badge: RivalBadge;
};

export type PlayerRivalries = {
  /** Opponent who has killed this player the most, all-time. */
  nemesis: RivalStat | null;
  /** Opponent this player has killed the most, all-time. */
  favouritePrey: RivalStat | null;
  /** Every opponent interacted with, richest rivalry first. */
  opponents: RivalStat[];
};

/**
 * Derive net, badges, nemesis and favourite prey from raw per-opponent tallies.
 * A "bully" is someone you dominate (net strongly positive with real volume); a
 * "victim" tag means they dominate you. Exported so the ingestion layer can feed
 * it raw rows and get the finished shape.
 */
export function buildRivalries(
  raw: { opsTag: string; profilePicUrl: string | null; killsFor: number; killsAgainst: number; encounters: number }[],
): PlayerRivalries {
  const opponents: RivalStat[] = raw.map((r) => {
    const net = r.killsFor - r.killsAgainst;
    const volume = r.killsFor + r.killsAgainst;
    // Badge only once there's enough interaction to be meaningful.
    let badge: RivalBadge = null;
    if (volume >= 6) {
      if (net >= 3 && r.killsFor >= r.killsAgainst * 2) badge = "bully";
      else if (net <= -3 && r.killsAgainst >= r.killsFor * 2) badge = "victim";
      else if (Math.abs(net) <= 1) badge = "even";
    }
    return { opsTag: r.opsTag, profilePicUrl: r.profilePicUrl, killsFor: r.killsFor, killsAgainst: r.killsAgainst, net, encounters: r.encounters, badge };
  });

  // Richest rivalry first: total interactions, then absolute dominance.
  opponents.sort((a, b) => (b.killsFor + b.killsAgainst) - (a.killsFor + a.killsAgainst) || Math.abs(b.net) - Math.abs(a.net));

  const nemesis = raw.length
    ? opponents.reduce((best, o) => (o.killsAgainst > (best?.killsAgainst ?? -1) ? o : best), null as RivalStat | null)
    : null;
  const favouritePrey = raw.length
    ? opponents.reduce((best, o) => (o.killsFor > (best?.killsFor ?? -1) ? o : best), null as RivalStat | null)
    : null;

  return { nemesis, favouritePrey, opponents };
}

export async function getPlayerRivalries(_supabase: SupabaseServer, _ops: string): Promise<PlayerRivalries> {
  // TODO(ingestion): replace with the real per-opponent aggregate once ingestion
  // writes head-to-head kills. Until then, empty -> the tab shows its empty state.
  return buildRivalries([]);
}
