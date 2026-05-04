import { fetchSheetAsObjects, parseNumericOr } from "@/lib/sheets";
import { CMS_REVALIDATE_SECONDS, CMS_URLS } from "./client";

/**
 * lib/cms/accolades.ts
 * --------------------------------------------------------------------
 * Authoritative metadata for accolades. The CMS sheet has one row per
 * accolade, with name, description, badge image URL, and XP value.
 *
 * Used by the Match Report's player stats section to render which
 * accolades the player earned in that match. Game_Data_Lookup has 15
 * `Accolade_<Name>` columns with 0/1 values. For each "1" column, we
 * look up the corresponding row in this CMS sheet to get its display
 * data.
 *
 * Match strategy: the Game_Data_Lookup column suffix (e.g. "Spray_n_Pray"
 * from "Accolade_Spray_n_Pray") is matched case-insensitively against
 * the CMS Accolade_Name column. If the CMS uses a different capitalisation
 * scheme (e.g. "Spray N Pray" with spaces), we do a flexible normalisation
 * match. Mismatches manifest as "missing accolades" in the UI rather than
 * crashes — defensive.
 */

type AccoladeRaw = Record<string, string> & {
  Accolade_Name: string;
  Accolade_Description: string;
  Accolade_Badge: string;
  Accolade_XP: string;
};

export type Accolade = {
  /** Canonical name as stored in the CMS, e.g. "Spray N Pray" */
  name: string;
  /** Lowercased+normalised key for lookup matching. */
  key: string;
  description: string;
  /** URL to the badge image. */
  badgeUrl: string;
  /** XP awarded for earning this accolade in a match. */
  xp: number;
};

/**
 * Normalise an accolade name into a lookup key. Strips non-alphanumeric
 * characters and lowercases, so:
 *   - "Spray N Pray" → "spraynpray"
 *   - "Spray_n_Pray" → "spraynpray"
 *   - "Apex Predator" → "apexpredator"
 * This makes the data-column suffix and CMS-name field matchable
 * regardless of casing or separator differences.
 */
export function accoladeKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function fetchAccolades(): Promise<Accolade[]> {
  const result = await fetchSheetAsObjects<AccoladeRaw>(
    CMS_URLS.accolades,
    CMS_REVALIDATE_SECONDS,
  );
  if (!result.ok) return [];

  const out: Accolade[] = [];
  for (const row of result.rows) {
    const name = (row.Accolade_Name ?? "").trim();
    if (name === "") continue;
    out.push({
      name,
      key: accoladeKey(name),
      description: (row.Accolade_Description ?? "").trim(),
      badgeUrl: (row.Accolade_Badge ?? "").trim(),
      xp: parseNumericOr(row.Accolade_XP, 0),
    });
  }
  return out;
}

/**
 * Build a fast lookup map from accolade key → metadata. Callers
 * iterate the player's "1" accolade columns and look up each by key.
 */
export function indexAccoladesByKey(accolades: Accolade[]): Map<string, Accolade> {
  const m = new Map<string, Accolade>();
  for (const a of accolades) m.set(a.key, a);
  return m;
}
