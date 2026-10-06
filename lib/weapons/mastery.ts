/**
 * lib/weapons/mastery.ts
 * --------------------------------------------------------------------
 * Weapon Mastery: per-gun Bronze/Silver/Gold/Platinum challenges.
 *
 * Requirements (fixed in code; the streaks/accolades they reference are the
 * admin-configurable streak_definitions.tier + accolade tiers):
 *   Bronze   - earn EACH tier-1 streak at least once WITH the gun
 *   Silver   - earn EACH tier-2 streak with the gun
 *   Gold     - earn EACH tier-3 streak with the gun + a Specialist accolade
 *   Platinum - earn EACH tier-4 streak with the gun + EACH tier-3 accolade
 *
 * Gun attribution is derivable because match_player_aggregate carries both
 * gun_used and the per-match `streaks` jsonb array, and match_awards (accolades)
 * joins to it on (match_id, account_id) -> gun_used. The per-gun badge art +
 * enablement live in the admin-managed weapon_mastery table.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type MasteryLevelKey = "bronze" | "silver" | "gold" | "platinum";

/** Static level config: which streak tier each level needs, in display order. */
export const MASTERY_LEVELS: { key: MasteryLevelKey; label: string; streakTier: number }[] = [
  { key: "bronze", label: "Bronze", streakTier: 1 },
  { key: "silver", label: "Silver", streakTier: 2 },
  { key: "gold", label: "Gold", streakTier: 3 },
  { key: "platinum", label: "Platinum", streakTier: 4 },
];

/** Top accolade tier (by XP) required for Platinum; Specialist XP for Gold. */
const TIER3_ACCOLADE_XP = 100;
const SPECIALIST_NAME = "Specialist";

export type MasteryRequirement = {
  label: string;
  kind: "streak" | "accolade";
  met: boolean;
  badgeUrl: string | null;
};

export type MasteryLevel = {
  key: MasteryLevelKey;
  label: string;
  /** Mastery badge art for this level (admin-managed). */
  badgeUrl: string | null;
  requirements: MasteryRequirement[];
  earned: boolean;
};

export type GunMastery = {
  gunName: string;
  /** Mastery is live for this gun (has an enabled weapon_mastery row). */
  enabled: boolean;
  /** No enabled config yet -> show "Mastery coming soon". */
  comingSoon: boolean;
  sortOrder: number;
  levels: MasteryLevel[];
  /** Earned level keys, lowest -> highest, for quick badge display. */
  earnedLevels: MasteryLevelKey[];
};

type MasteryRow = {
  gun_name: string;
  enabled: boolean;
  sort_order: number | null;
  bronze_badge_url: string | null;
  silver_badge_url: string | null;
  gold_badge_url: string | null;
  platinum_badge_url: string | null;
};
type StreakDefRow = { streak_key: string; name: string; tier: number | null; badge_url: string | null };
type AccDefRow = { id: string; name: string; xp: number | null; badge_url: string | null };
type MpaRow = { match_id: string; gun_used: string | null; streaks: { key?: string; count?: number }[] | null };
type AwardRow = { match_id: string; accolade_definition_id: string };

function badgeFor(row: MasteryRow, key: MasteryLevelKey): string | null {
  return key === "bronze" ? row.bronze_badge_url
    : key === "silver" ? row.silver_badge_url
    : key === "gold" ? row.gold_badge_url
    : row.platinum_badge_url;
}

/**
 * Compute per-gun mastery for one player, keyed by gun name. Returns an entry
 * for every enabled weapon_mastery gun (even with no player data -> all locked).
 */
export async function getWeaponMasteryByGun(
  supabase: SupabaseClient,
  opsTag: string,
): Promise<Map<string, GunMastery>> {
  const out = new Map<string, GunMastery>();
  const needle = opsTag.trim();

  // Config first (independent of the player): all enabled mastery guns + the
  // streak/accolade catalogues that define the requirements.
  const [{ data: masteryRows }, { data: streakDefs }, { data: accDefs }] = await Promise.all([
    supabase
      .from("weapon_mastery")
      .select("gun_name, enabled, sort_order, bronze_badge_url, silver_badge_url, gold_badge_url, platinum_badge_url")
      .eq("enabled", true)
      .order("sort_order", { ascending: true }),
    supabase.from("streak_definitions").select("streak_key, name, tier, badge_url").eq("is_active", true),
    supabase.from("accolade_definitions").select("id, name, xp, badge_url").eq("is_active", true),
  ]);

  const guns = (masteryRows ?? []) as MasteryRow[];
  if (guns.length === 0) return out;

  // Tier -> list of streaks {key,name,badge}.
  const streaksByTier = new Map<number, { key: string; name: string; badge: string | null }[]>();
  for (const s of (streakDefs ?? []) as StreakDefRow[]) {
    if (s.tier == null) continue;
    const arr = streaksByTier.get(s.tier) ?? [];
    arr.push({ key: s.streak_key, name: s.name, badge: s.badge_url });
    streaksByTier.set(s.tier, arr);
  }

  // Accolades: id -> name, and the tier-3 set (by name) + Specialist badge.
  const accNameById = new Map<string, string>();
  const tier3Acc = new Map<string, string | null>(); // name -> badge
  let specialistBadge: string | null = null;
  for (const a of (accDefs ?? []) as AccDefRow[]) {
    accNameById.set(a.id, a.name);
    if ((a.xp ?? 0) === TIER3_ACCOLADE_XP) tier3Acc.set(a.name, a.badge_url);
    if (a.name === SPECIALIST_NAME && specialistBadge == null) specialistBadge = a.badge_url;
  }

  // Resolve the player; without data every gun is still returned (all locked).
  const gunStreaks = new Map<string, Set<string>>(); // gun -> earned streak keys
  const gunAccNames = new Map<string, Set<string>>(); // gun -> earned accolade names
  if (needle !== "") {
    const { data: life } = await supabase
      .from("player_stats_lifetime")
      .select("account_id")
      .ilike("nickname", needle)
      .maybeSingle<{ account_id: string }>();
    if (life) {
      const [{ data: mpa }, { data: awards }] = await Promise.all([
        supabase.from("match_player_aggregate").select("match_id, gun_used, streaks").eq("account_id", life.account_id),
        supabase.from("match_awards").select("match_id, accolade_definition_id").eq("account_id", life.account_id),
      ]);
      const gunByMatch = new Map<string, string>();
      for (const r of (mpa ?? []) as MpaRow[]) {
        const gun = r.gun_used ?? "";
        if (gun === "") continue;
        gunByMatch.set(r.match_id, gun);
        const set = gunStreaks.get(gun) ?? new Set<string>();
        for (const s of r.streaks ?? []) {
          if (s && typeof s.key === "string" && (s.count ?? 0) > 0) set.add(s.key);
        }
        gunStreaks.set(gun, set);
      }
      for (const a of (awards ?? []) as AwardRow[]) {
        const gun = gunByMatch.get(a.match_id);
        const name = accNameById.get(a.accolade_definition_id);
        if (!gun || !name) continue;
        const set = gunAccNames.get(gun) ?? new Set<string>();
        set.add(name);
        gunAccNames.set(gun, set);
      }
    }
  }

  const tier3Names = Array.from(tier3Acc.keys());

  for (const row of guns) {
    const earnedStreaks = gunStreaks.get(row.gun_name) ?? new Set<string>();
    const earnedAcc = gunAccNames.get(row.gun_name) ?? new Set<string>();

    const levels: MasteryLevel[] = MASTERY_LEVELS.map((lvl) => {
      const reqs: MasteryRequirement[] = [];
      for (const s of streaksByTier.get(lvl.streakTier) ?? []) {
        reqs.push({ label: s.name, kind: "streak", met: earnedStreaks.has(s.key), badgeUrl: s.badge });
      }
      if (lvl.key === "gold") {
        reqs.push({ label: SPECIALIST_NAME, kind: "accolade", met: earnedAcc.has(SPECIALIST_NAME), badgeUrl: specialistBadge });
      }
      if (lvl.key === "platinum") {
        for (const name of tier3Names) {
          reqs.push({ label: name, kind: "accolade", met: earnedAcc.has(name), badgeUrl: tier3Acc.get(name) ?? null });
        }
      }
      const earned = reqs.length > 0 && reqs.every((r) => r.met);
      return { key: lvl.key, label: lvl.label, badgeUrl: badgeFor(row, lvl.key), requirements: reqs, earned };
    });

    out.set(row.gun_name, {
      gunName: row.gun_name,
      enabled: true,
      comingSoon: false,
      sortOrder: row.sort_order ?? 999,
      levels,
      earnedLevels: levels.filter((l) => l.earned).map((l) => l.key),
    });
  }

  return out;
}
