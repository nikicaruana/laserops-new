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

type KillEntry = { nickname?: string | null; headband?: string | null; count?: number | null };

/**
 * All-time head-to-head kills for a player, aggregated across their matches from
 * match_player_aggregate.killed / killed_by (populated for online rounds only).
 * Unresolved walk-ins ("Head NN") are skipped - a rivalry needs a real opponent.
 */
export async function getPlayerRivalries(supabase: SupabaseServer, ops: string): Promise<PlayerRivalries> {
  const tag = ops.trim();
  if (!tag) return buildRivalries([]);

  // Resolve the player's account (best-effort; falls back to nickname match).
  const { data: acc } = await supabase.from("accounts").select("id").ilike("ops_tag", tag).maybeSingle();
  let q = supabase.from("match_player_aggregate").select("match_id, killed, killed_by");
  q = acc?.id ? q.eq("account_id", acc.id as string) : q.eq("nickname", tag);
  const { data: rows } = await q;
  if (!rows || rows.length === 0) return buildRivalries([]);

  const isHead = (n: string) => /^head\s*\d+$/i.test(n);
  const agg = new Map<string, { killsFor: number; killsAgainst: number; matches: Set<string> }>();
  const bump = (name: string | null | undefined, matchId: string, forK: number, againstK: number) => {
    const key = (name ?? "").trim();
    if (!key || isHead(key) || key.toLowerCase() === tag.toLowerCase()) return;
    const e = agg.get(key) ?? { killsFor: 0, killsAgainst: 0, matches: new Set<string>() };
    e.killsFor += forK;
    e.killsAgainst += againstK;
    e.matches.add(matchId);
    agg.set(key, e);
  };
  for (const r of rows as { match_id: string; killed: KillEntry[] | null; killed_by: KillEntry[] | null }[]) {
    for (const k of r.killed ?? []) bump(k.nickname || k.headband, r.match_id, Number(k.count) || 0, 0);
    for (const k of r.killed_by ?? []) bump(k.nickname || k.headband, r.match_id, 0, Number(k.count) || 0);
  }
  if (agg.size === 0) return buildRivalries([]);

  // Opponent avatars from their aggregate rows (public-readable; avoids accounts RLS).
  const names = [...agg.keys()];
  const { data: picRows } = await supabase
    .from("match_player_aggregate")
    .select("nickname, profile_pic_url")
    .in("nickname", names)
    .not("profile_pic_url", "is", null);
  const picByTag = new Map<string, string>();
  for (const pr of (picRows ?? []) as { nickname: string; profile_pic_url: string | null }[]) {
    if (pr.profile_pic_url && !picByTag.has(pr.nickname)) picByTag.set(pr.nickname, pr.profile_pic_url);
  }

  const raw = names.map((n) => ({
    opsTag: n,
    profilePicUrl: picByTag.get(n) ?? null,
    killsFor: agg.get(n)!.killsFor,
    killsAgainst: agg.get(n)!.killsAgainst,
    encounters: agg.get(n)!.matches.size,
  }));
  return buildRivalries(raw);
}
