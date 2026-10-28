/**
 * lib/admin/match-filters.ts
 * --------------------------------------------------------------------
 * Shared (server + client) definitions for the Match Manager multi-select
 * filters. Kept in a plain module - NOT the "use client" component file - so the
 * server page can call parseSelection() without Next treating it as a client
 * function reference.
 *
 * URL encoding for each filter param (?status / ?type):
 *   absent      -> the default selection (DEFAULT_STATUS / DEFAULT_TYPE)
 *   "none"      -> empty selection
 *   "a,b,c"     -> those keys (invalid keys ignored)
 */

export const STATUS_TABS: { key: string; label: string }[] = [
  { key: "tentative", label: "Tentative" },
  { key: "awaiting_confirm", label: "Awaiting OK" },
  { key: "confirmed", label: "Confirmed" },
  { key: "live", label: "Live" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

export const TYPE_TABS: { key: string; label: string }[] = [
  { key: "laserops_open", label: "LaserOps Open" },
  { key: "double_xp", label: "Double XP" },
  { key: "community_open", label: "Community Open" },
  { key: "private", label: "Private Bookings" },
];

export const STATUS_KEYS = STATUS_TABS.map((t) => t.key);
export const TYPE_KEYS = TYPE_TABS.map((t) => t.key);

/** Selected by default when no ?status is present: the four active lifecycle
 *  states (completed + cancelled are hidden until explicitly selected). */
export const DEFAULT_STATUS = ["tentative", "awaiting_confirm", "confirmed", "live"];
/** Selected by default when no ?type is present: every type. */
export const DEFAULT_TYPE = TYPE_KEYS;

/** Parse a comma-separated multi-select URL param. */
export function parseSelection(param: string | undefined | null, all: string[], def: string[]): string[] {
  if (param == null) return def;
  if (param === "none") return [];
  return param.split(",").map((s) => s.trim()).filter((k) => all.includes(k));
}

/** Encode a selection to its URL value: "none" when empty, else the joined keys. */
export function encodeSelection(values: string[]): string {
  return values.length === 0 ? "none" : values.join(",");
}
