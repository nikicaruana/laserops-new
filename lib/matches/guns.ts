/**
 * lib/matches/guns.ts
 * --------------------------------------------------------------------
 * A player's unlocked guns (name + display label + image) from player_armory,
 * for the gun carousel used when booking / joining a match.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type UnlockedGun = { name: string; label: string; img: string | null };

type ArmoryRow = {
  gun_name: string | null;
  gun_display_title: string | null;
  gun_used_img: string | null;
  gun_player_image: string | null;
};

export async function getUnlockedGuns(
  supabase: SupabaseClient,
  accountId: string,
): Promise<UnlockedGun[]> {
  const { data } = await supabase
    .from("player_armory")
    .select("gun_name, gun_display_title, gun_used_img, gun_player_image, gun_sort_order")
    .eq("account_id", accountId)
    .eq("gun_is_unlocked", true)
    .order("gun_sort_order");

  const seen = new Set<string>();
  const out: UnlockedGun[] = [];
  for (const r of (data ?? []) as ArmoryRow[]) {
    if (!r.gun_name || seen.has(r.gun_name)) continue;
    seen.add(r.gun_name);
    out.push({
      name: r.gun_name,
      label: r.gun_display_title || r.gun_name,
      img: r.gun_used_img || r.gun_player_image || null,
    });
  }
  return out;
}
