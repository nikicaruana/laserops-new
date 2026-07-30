/**
 * lib/cms/supabase-weapons.ts
 * --------------------------------------------------------------------
 * Supabase-backed replacement for fetchWeapons(). Returns the existing
 * Weapon[] shape from the guns config table, so the armory, Hall-of-Fame
 * weapon masters, and the marketing weapons pages render unchanged.
 *
 * guns.fire_rate is TEXT (holds either an RPM string like "725" or
 * "Semi Auto"), so we reuse the exact parseFireRate() discriminator from
 * lib/cms/weapons — semi-auto weapons stay semi-auto. Uses the cookieless
 * public client so static / ISR pages keep static rendering.
 */
import { createPublicClient } from "@/lib/supabase/public";
import {
  parseFireRate,
  isFallbackGunName,
  type Weapon,
} from "@/lib/cms/weapons";

const n = (v: number | null | undefined): number => v ?? 0;
const s = (v: string | null | undefined): string => (v ?? "").trim();

type Row = {
  name: string | null;
  image_url: string | null;
  class: string | null;
  is_default: boolean | null;
  tree_branch: string | null;
  sort_order: number | null;
  mag_size: number | null;
  damage: number | null;
  reload: number | null;
  fire_rate: string | null;
  length: number | null;
  weight: number | null;
  gun_range: number | null;
  unlock_tier: string | null;
  difficulty: string | null;
  description: string | null;
  unlock_type: string | null;
  unlock_display_text: string | null;
  unlock_prerequisite_class: string | null;
  unlock_prerequisite_gun: string | null;
  unlock_requirement_points: number | null;
  unlock_requirement_level: number | null;
};

export async function getWeaponsFromSupabase(): Promise<Weapon[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("guns")
    .select(
      "name, image_url, class, is_default, tree_branch, sort_order, mag_size, damage, reload, fire_rate, length, weight, gun_range, unlock_tier, difficulty, description, unlock_type, unlock_display_text, unlock_prerequisite_class, unlock_prerequisite_gun, unlock_requirement_points, unlock_requirement_level",
    )
    .order("sort_order");

  const out: Weapon[] = [];
  for (const r of (data ?? []) as Row[]) {
    const name = s(r.name);
    // Drop the synthetic "Unknown" / "None" fallback gun rows — same filter
    // the sheet path applies so the gallery + usage-stats stay in sync.
    if (name === "" || isFallbackGunName(name)) continue;

    out.push({
      name,
      imageUrl: s(r.image_url),
      gunClass: s(r.class),
      isDefault: r.is_default === true,
      treeBranch: s(r.tree_branch),
      sortOrder: n(r.sort_order),
      magSize: n(r.mag_size),
      damage: n(r.damage),
      reloadSeconds: n(r.reload),
      fireRate: parseFireRate(r.fire_rate ?? undefined),
      length: n(r.length),
      weight: n(r.weight),
      range: n(r.gun_range),
      unlockTier: s(r.unlock_tier),
      difficulty: s(r.difficulty),
      description: s(r.description),
      unlockType: s(r.unlock_type),
      unlockDisplayText: s(r.unlock_display_text),
      unlockPrereqClass: s(r.unlock_prerequisite_class),
      unlockPrereqGun: s(r.unlock_prerequisite_gun),
      unlockReqPoints: n(r.unlock_requirement_points),
      unlockReqLevel: n(r.unlock_requirement_level),
    });
  }

  out.sort((a, b) => a.sortOrder - b.sortOrder);
  return out;
}
