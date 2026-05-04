import { fetchSheetAsObjects } from "@/lib/sheets";
import { CMS_REVALIDATE_SECONDS, CMS_URLS } from "./client";

/**
 * Raw shape of a Site_Config row.
 */
type SiteConfigRaw = Record<string, string> & {
  Key: string;
  Value: string;
};

/**
 * Site_Config tab is a flat key/value store for global toggles and
 * settings that don't fit into a more structured tab. Examples:
 *   - homepage_show_season_leaders: true|false
 *   - homepage_season_leaders_count: integer
 *
 * Returned as a Map<string, string> so callers can use .get() with
 * defaults. Type coercion is each caller's responsibility — the CMS
 * editor sees plain strings, and different keys may need different
 * coercions (booleans, numbers, etc).
 */
export async function fetchSiteConfig(): Promise<Map<string, string>> {
  const result = await fetchSheetAsObjects<SiteConfigRaw>(
    CMS_URLS.siteConfig,
    CMS_REVALIDATE_SECONDS,
  );
  if (!result.ok) {
    return new Map();
  }

  const map = new Map<string, string>();
  for (const row of result.rows) {
    const key = (row.Key ?? "").trim();
    if (key === "") continue;
    map.set(key, (row.Value ?? "").trim());
  }
  return map;
}

/**
 * Convenience helper: read a config value as a boolean.
 * Treats "true" (case-insensitive) as true; anything else as the default.
 */
export function configBool(
  config: Map<string, string>,
  key: string,
  defaultValue: boolean,
): boolean {
  const raw = config.get(key);
  if (raw === undefined) return defaultValue;
  const v = raw.toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return defaultValue;
}

/**
 * Convenience helper: read a config value as an integer.
 */
export function configInt(
  config: Map<string, string>,
  key: string,
  defaultValue: number,
): number {
  const raw = config.get(key);
  if (raw === undefined) return defaultValue;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : defaultValue;
}

/**
 * Convenience helper: read a config value as a string.
 * Returns the default if the key is missing or the value is empty
 * (whitespace-only counts as empty).
 */
export function configString(
  config: Map<string, string>,
  key: string,
  defaultValue: string,
): string {
  const raw = config.get(key);
  if (raw === undefined) return defaultValue;
  const trimmed = raw.trim();
  return trimmed === "" ? defaultValue : trimmed;
}
