/**
 * lib/ingestion/roster.ts
 * --------------------------------------------------------------------
 * Resolve a match's headbands to their real identities + gun for the commit and
 * the post-publish edit step. Assigned headbands (match_participants → accounts)
 * resolve to the player's profile (ops_tag + avatar); unassigned ones keep their
 * raw "Head 39" label. Also surfaces the booked gun and any spent XP-boost
 * multiplier. Headbands appear as "Head 39" in round data but are stored as the
 * bare number ("39") on match_participants, so matching is on the numeric part.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type RosterEntry = {
  nickname: string;
  accountId: string | null;
  profilePicUrl: string | null;
  gun: string | null;
  xpMultiplier: number;
};

export type RosterResolver = (headband: string) => RosterEntry;

/** Normalise a headband label to its number, so "Head 39" and "39" match. */
export const hbKey = (s: string | null | undefined) => {
  const m = String(s ?? "").match(/\d+/);
  return m ? String(parseInt(m[0], 10)) : "";
};

export async function resolveRoster(supabase: SupabaseClient, matchId: string): Promise<RosterResolver> {
  const { data: parts } = await supabase
    .from("match_participants")
    .select("headset_label, account_id, display_name, gun_used, xp_multiplier")
    .eq("match_id", matchId);

  const accIds = [...new Set((parts ?? []).map((p) => p.account_id).filter(Boolean) as string[])];
  const { data: accRows } = accIds.length
    ? await supabase.from("accounts").select("id, ops_tag, profile_pic_url").in("id", accIds)
    : { data: [] as { id: string; ops_tag: string | null; profile_pic_url: string | null }[] };
  const accById = new Map((accRows ?? []).map((a) => [a.id as string, a]));

  const byHb = new Map<string, RosterEntry>();
  for (const p of parts ?? []) {
    const k = hbKey(p.headset_label as string);
    if (!k) continue;
    const acc = p.account_id ? accById.get(p.account_id as string) : undefined;
    byHb.set(k, {
      nickname: acc?.ops_tag || (p.display_name as string) || "",
      accountId: (p.account_id as string) ?? null,
      profilePicUrl: acc?.profile_pic_url ?? null,
      gun: (p.gun_used as string) || null,
      xpMultiplier: Number(p.xp_multiplier ?? 1) || 1,
    });
  }

  return (headband: string) => {
    const hit = byHb.get(hbKey(headband));
    if (hit && hit.nickname) return hit;
    return {
      nickname: headband,
      accountId: hit?.accountId ?? null,
      profilePicUrl: hit?.profilePicUrl ?? null,
      gun: hit?.gun ?? null,
      xpMultiplier: hit?.xpMultiplier ?? 1,
    };
  };
}
