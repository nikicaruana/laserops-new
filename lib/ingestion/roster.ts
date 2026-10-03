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

/** Normalise an identity label (ops tag / display name) for nickname matching. */
const normName = (s: string | null | undefined) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

export async function resolveRoster(supabase: SupabaseClient, matchId: string): Promise<RosterResolver> {
  const { data: parts } = await supabase
    .from("match_participants")
    .select("headset_label, account_id, display_name, gun_used, xp_multiplier, extra_headbands")
    .eq("match_id", matchId);

  const accIds = [...new Set((parts ?? []).map((p) => p.account_id).filter(Boolean) as string[])];
  const { data: accRows } = accIds.length
    ? await supabase.from("accounts").select("id, ops_tag, profile_pic_url").in("id", accIds)
    : { data: [] as { id: string; ops_tag: string | null; profile_pic_url: string | null }[] };
  const accById = new Map((accRows ?? []).map((a) => [a.id as string, a]));

  const byHb = new Map<string, RosterEntry>();
  // Also index by resolved nickname (ops tag / display name): the scoring engine
  // renames each resolved player to their nickname and then re-looks them up, so
  // the resolver must accept a nickname, not just a headband number - otherwise
  // the account link is lost at aggregation.
  const byName = new Map<string, RosterEntry>();
  for (const p of parts ?? []) {
    const acc = p.account_id ? accById.get(p.account_id as string) : undefined;
    const entry: RosterEntry = {
      nickname: acc?.ops_tag || (p.display_name as string) || "",
      accountId: (p.account_id as string) ?? null,
      profilePicUrl: acc?.profile_pic_url ?? null,
      gun: (p.gun_used as string) || null,
      xpMultiplier: Number(p.xp_multiplier ?? 1) || 1,
    };
    if (entry.nickname) { const nk = normName(entry.nickname); if (nk && !byName.has(nk)) byName.set(nk, entry); }
    const k = hbKey(p.headset_label as string);
    if (k) byHb.set(k, entry);
    // Extra headbands (mid-game swaps) resolve to the SAME player, so their
    // stats merge into one row at scoring time.
    for (const ex of ((p.extra_headbands as string[] | null) ?? [])) {
      const ek = hbKey(ex);
      if (ek && !byHb.has(ek)) byHb.set(ek, entry);
    }
  }

  return (headband: string) => {
    const raw = String(headband);
    // A nickname/ops-tag match (how the engine re-looks-up a renamed player).
    // Tried first for non-numeric input so a nickname like "Agius89" isn't
    // mis-read as headband 89; a bare number is treated as a headband.
    if (!/^\d+$/.test(raw.trim())) {
      const named = byName.get(normName(raw));
      if (named && named.nickname) return named;
    }
    const hit = byHb.get(hbKey(raw));
    if (hit && hit.nickname) return hit;
    const named = byName.get(normName(raw));
    if (named && named.nickname) return named;
    return {
      nickname: raw,
      accountId: hit?.accountId ?? null,
      profilePicUrl: hit?.profilePicUrl ?? null,
      gun: hit?.gun ?? null,
      xpMultiplier: hit?.xpMultiplier ?? 1,
    };
  };
}
