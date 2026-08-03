/**
 * lib/matches/guns.ts
 * --------------------------------------------------------------------
 * A player's unlocked guns (name + display label + image) from player_armory,
 * for the gun carousel used when booking / joining a match.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isFallbackGunName } from "@/lib/cms/weapons";

export type UnlockedGun = { name: string; label: string; img: string | null };

type ArmoryRow = {
  gun_name: string | null;
  gun_display_title: string | null;
  gun_used_img: string | null;
  gun_player_image: string | null;
  gun_is_unlocked: boolean | null;
};

export async function getUnlockedGuns(
  supabase: SupabaseClient,
  opsTag: string | null | undefined,
  opts: { includeLocked?: boolean } = {},
): Promise<UnlockedGun[]> {
  if (!opsTag || !opsTag.trim()) return [];
  // Armory rows are keyed by nickname (ops_tag); account_id is null on
  // unresolved rows, so match on nickname like the canonical armory adapter.
  // includeLocked (admins) returns the whole catalogue, not just unlocked guns.
  let query = supabase
    .from("player_armory")
    .select("gun_name, gun_display_title, gun_used_img, gun_player_image, gun_is_unlocked, gun_sort_order")
    .ilike("nickname", opsTag.trim())
    .order("gun_sort_order");
  if (!opts.includeLocked) query = query.eq("gun_is_unlocked", true);
  const { data } = await query;

  const seen = new Set<string>();
  const out: UnlockedGun[] = [];
  for (const r of (data ?? []) as ArmoryRow[]) {
    // Never surface the synthetic "Unknown" / "None" fallback gun.
    if (!r.gun_name || isFallbackGunName(r.gun_name) || seen.has(r.gun_name)) continue;
    seen.add(r.gun_name);
    // gun_display_title holds the UNLOCK CRITERIA text for locked guns (only
    // visible to admins/excluded who see locked guns), so only trust it when
    // the gun is unlocked; otherwise fall back to the gun name.
    const label = r.gun_is_unlocked ? r.gun_display_title || r.gun_name : r.gun_name;
    out.push({
      name: r.gun_name,
      label,
      img: r.gun_used_img || r.gun_player_image || null,
    });
  }
  return out;
}
