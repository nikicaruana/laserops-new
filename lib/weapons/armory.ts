import type { PlayerArmoryRow } from "@/lib/cms/player-armory";
import { isFallbackGunName, type Weapon } from "@/lib/cms/weapons";

/**
 * lib/weapons/armory.ts
 * --------------------------------------------------------------------
 * Joins per-player armory rows (lib/cms/player-armory.ts) with the
 * static gun catalogue (lib/cms/weapons.ts) and groups the result by
 * Gun_Tree_Branch for the Armory page.
 *
 * The join is a left-join: every PlayerArmoryRow becomes one ArmoryEntry,
 * regardless of whether a matching Weapon spec exists. Renderers should
 * gate spec-only fields (description, length, weight, range, etc.) on
 * `entry.spec` being defined.
 */

export type ArmoryEntry = PlayerArmoryRow & {
  /** Matching row from the Gun_Damage / weapons sheet, when found by
   *  case-insensitive gun name. Undefined when the catalogue has no
   *  matching row — renderers fall back to PlayerArmoryRow's own
   *  display fields (gunMagSize, gunDamage, gunReload, gunFireRate). */
  spec?: Weapon;
};

export type ArmoryBranch = {
  branch: string;
  entries: ArmoryEntry[];
};

export function buildPlayerArmory(
  armoryRows: PlayerArmoryRow[],
  weapons: Weapon[],
): ArmoryBranch[] {
  const specByName = new Map<string, Weapon>();
  for (const w of weapons) {
    specByName.set(w.name.trim().toLowerCase(), w);
  }

  const grouped = new Map<string, ArmoryEntry[]>();
  for (const row of armoryRows) {
    if (row.treeBranch === "" || isFallbackGunName(row.treeBranch)) continue;
    if (isFallbackGunName(row.gunName)) continue;

    const entry: ArmoryEntry = {
      ...row,
      spec: specByName.get(row.gunName.trim().toLowerCase()),
    };
    const list = grouped.get(row.treeBranch);
    if (list) list.push(entry);
    else grouped.set(row.treeBranch, [entry]);
  }

  const branches: ArmoryBranch[] = [];
  for (const [branch, entries] of grouped.entries()) {
    entries.sort((a, b) => a.sortOrder - b.sortOrder);
    branches.push({ branch, entries });
  }

  // Preferred branch order: AR before AK, then everything else by sortOrder.
  const BRANCH_PRIORITY: Record<string, number> = {
    AR: 0,
    AK: 1,
  };

  branches.sort((a, b) => {
    const prioA = BRANCH_PRIORITY[a.branch] ?? 999;
    const prioB = BRANCH_PRIORITY[b.branch] ?? 999;
    if (prioA !== prioB) return prioA - prioB;
    // Fall back to the first entry's sortOrder for unlisted branches.
    const minA = a.entries.length > 0 ? a.entries[0].sortOrder : 0;
    const minB = b.entries.length > 0 ? b.entries[0].sortOrder : 0;
    return minA - minB;
  });

  return branches;
}
