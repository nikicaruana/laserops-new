/**
 * lib/guns/match-order.ts
 * --------------------------------------------------------------------
 * Canonical ordering for the gun dropdowns in the admin Match Manager. The
 * headline guns lead in a fixed order (matched by keyword, so the stored FULL
 * names - e.g. "AR-15 Ranger" - are preserved and shown); every other gun
 * follows alphabetically.
 */
const PRIORITY: string[][] = [
  ["ranger"],
  ["predator"],
  ["phoenix", "pheonix"],
  ["berserk"],
  ["ghost"],
  ["sniper"],
];

function gunRank(name: string): number {
  const n = name.toLowerCase();
  const i = PRIORITY.findIndex((keys) => keys.some((k) => n.includes(k)));
  return i === -1 ? PRIORITY.length : i;
}

/** Sort full gun names into the Match Manager's canonical dropdown order. */
export function orderMatchGuns(names: string[]): string[] {
  return [...names].sort((a, b) => gunRank(a) - gunRank(b) || a.localeCompare(b));
}
