import { fetchSheetAsObjects, parseNumericOr } from "@/lib/sheets";
import { CMS_REVALIDATE_SECONDS, CMS_URLS } from "./client";

/**
 * lib/cms/weapons.ts
 * --------------------------------------------------------------------
 * Loadout / weapons metadata. One row per gun.
 *
 * Lives on the DATA spreadsheet (same one as accolades, ranking system,
 * game id map) — see CMS_URLS.weapons in client.ts.
 *
 * Used by /weapons (the gallery page) and potentially by the Match
 * Report's gun-used display in the future. For now only the gallery
 * consumes this.
 *
 * Sort order: every consumer probably wants `Gun_Sort_Order` ascending,
 * so the public fetcher pre-sorts that way. Filter by tree branch on
 * top of the sorted list at the call site.
 */

type WeaponRaw = Record<string, string> & {
  Damage: string;
  Gun_Used_Img: string;
  "Gun Class": string;
  Is_Default: string;
  Unlock_Type: string;
  Unlock_Prerequisite_Class: string;
  Unlock_Prerequisite_Gun: string;
  Unlock_Requirement_Points: string;
  Unlock_Requirement_Level: string;
  Unlock_Display_Text: string;
  Gun_Sort_Order: string;
  Gun_Tree_Branch: string;
  Gun_Mag_Size: string;
  Gun_Damage: string;
  Gun_Reload: string;
  Gun_Fire_Rate: string;
  Gun_Length: string;
  Gun_Weight: string;
  Gun_Range: string;
  Gun_Unlock_Tier: string;
  Gun_Difficulty: string;
  Gun_Description: string;
};

/**
 * Fire rate is either a number (full-auto RPM) or the literal string
 * "semi auto" / "semi-auto" (case-insensitive). We discriminate at
 * the parser layer so consumers don't have to re-detect it.
 *
 * Comparison rule baked into compareFireRate below: full-auto always
 * beats semi-auto regardless of the numeric value, full-auto vs
 * full-auto compares RPMs, semi vs semi is a tie.
 */
export type FireRate =
  | { kind: "auto"; rpm: number }
  | { kind: "semi" };

/**
 * Parsed weapon record. Numeric fields are coerced once here so the
 * gallery doesn't need to do parseFloat on every render.
 */
export type Weapon = {
  name: string;
  imageUrl: string;
  gunClass: string;
  isDefault: boolean;
  treeBranch: string;
  sortOrder: number;
  magSize: number;
  damage: number;
  reloadSeconds: number;
  /** Discriminated — see FireRate type. Use formatFireRate() to render
   *  in the UI and compareFireRate() to determine the winner of two
   *  guns in compare mode. */
  fireRate: FireRate;
  length: number;
  weight: number;
  range: number;
  unlockTier: string;
  difficulty: string;
  /** Long-form description shown in the tap-to-open detail popup.
   *  Empty string when the sheet hasn't filled this in yet. */
  description: string;
  unlockType: string;
  unlockDisplayText: string;
  unlockPrereqClass: string;
  unlockPrereqGun: string;
  unlockReqPoints: number;
  unlockReqLevel: number;
};

export async function fetchWeapons(): Promise<Weapon[]> {
  const result = await fetchSheetAsObjects<WeaponRaw>(
    CMS_URLS.weapons,
    CMS_REVALIDATE_SECONDS,
  );
  if (!result.ok) return [];

  const out: Weapon[] = [];
  for (const row of result.rows) {
    const name = (row["Gun Name"] ?? "").trim();
    if (name === "") continue;
    // Drop the synthetic "Unknown" row. The data sheet keeps an
    // "Unknown" entry as a fallback for matches where no gun was
    // logged (so Match Report joins don't break), but it's not a
    // real weapon and shouldn't appear in the gallery.
    if (name.toLowerCase() === "unknown") continue;

    out.push({
      name,
      imageUrl: (row.Gun_Used_Img ?? "").trim(),
      gunClass: (row["Gun Class"] ?? "").trim(),
      isDefault: parseBoolish(row.Is_Default),
      treeBranch: (row.Gun_Tree_Branch ?? "").trim(),
      sortOrder: parseNumericOr(row.Gun_Sort_Order, 0),
      magSize: parseNumericOr(row.Gun_Mag_Size, 0),
      damage: parseNumericOr(row.Gun_Damage, 0),
      reloadSeconds: parseNumericOr(row.Gun_Reload, 0),
      fireRate: parseFireRate(row.Gun_Fire_Rate),
      length: parseNumericOr(row.Gun_Length, 0),
      weight: parseNumericOr(row.Gun_Weight, 0),
      range: parseNumericOr(row.Gun_Range, 0),
      unlockTier: (row.Gun_Unlock_Tier ?? "").trim(),
      difficulty: (row.Gun_Difficulty ?? "").trim(),
      description: (row.Gun_Description ?? "").trim(),
      unlockType: (row.Unlock_Type ?? "").trim(),
      unlockDisplayText: (row.Unlock_Display_Text ?? "").trim(),
      unlockPrereqClass: (row.Unlock_Prerequisite_Class ?? "").trim(),
      unlockPrereqGun: (row.Unlock_Prerequisite_Gun ?? "").trim(),
      unlockReqPoints: parseNumericOr(row.Unlock_Requirement_Points, 0),
      unlockReqLevel: parseNumericOr(row.Unlock_Requirement_Level, 0),
    });
  }

  out.sort((a, b) => a.sortOrder - b.sortOrder);
  return out;
}

export function listGunTreeBranches(weapons: Weapon[]): string[] {
  const seen = new Set<string>();
  for (const w of weapons) {
    if (w.treeBranch !== "") seen.add(w.treeBranch);
  }
  return Array.from(seen).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

/* ---------- Fire rate helpers ---------- */

/**
 * Parse the Gun_Fire_Rate cell. Recognises:
 *   - Numeric values (full-auto RPM): "725", "600", "120"
 *   - Semi-auto markers: "semi auto", "semi-auto", "semi" (any case)
 *
 * Anything else falls back to {kind: "auto", rpm: 0} so the gun is
 * still rendered but loses every comparison. Empty cell → also rpm:0.
 *
 * The parser is deliberately forgiving on the semi-auto string —
 * Niki's spreadsheet is the source of truth, and small variations
 * in how the value gets typed shouldn't break the rendering.
 */
function parseFireRate(value: string | undefined): FireRate {
  if (!value) return { kind: "auto", rpm: 0 };
  const trimmed = value.trim();
  if (trimmed === "") return { kind: "auto", rpm: 0 };

  // Semi-auto detection — checks the lowercased trimmed text against
  // the common spellings.
  const lower = trimmed.toLowerCase();
  if (lower === "semi auto" || lower === "semi-auto" || lower === "semi") {
    return { kind: "semi" };
  }

  // Numeric — parseNumericOr handles strings like "725", "725.0",
  // "725 rpm" (it strips trailing non-numeric). NaN → 0.
  const rpm = parseNumericOr(trimmed, 0);
  return { kind: "auto", rpm };
}

/**
 * Render a FireRate for display. Returns "—" for zero/missing,
 * "Semi" for semi-auto, or the RPM number as a plain string.
 */
export function formatFireRate(fr: FireRate): string {
  if (fr.kind === "semi") return "Semi";
  if (fr.rpm === 0) return "—";
  return Math.round(fr.rpm).toString();
}

/**
 * Compare two fire rates. Used by the compare-mode highlighting
 * logic on the stats panel.
 *
 * Rules:
 *   - Full-auto always beats semi-auto, regardless of numeric value.
 *   - Two full-autos compare by RPM (higher wins).
 *   - Two semi-autos tie.
 *
 * Returns:
 *   - "a"   : a wins
 *   - "b"   : b wins
 *   - "tie" : draw or both missing
 */
export function compareFireRate(a: FireRate, b: FireRate): "a" | "b" | "tie" {
  if (a.kind === "auto" && b.kind === "semi") return "a";
  if (a.kind === "semi" && b.kind === "auto") return "b";
  if (a.kind === "semi" && b.kind === "semi") return "tie";
  // Both auto.
  const aRpm = a.kind === "auto" ? a.rpm : 0;
  const bRpm = b.kind === "auto" ? b.rpm : 0;
  if (aRpm > bRpm) return "a";
  if (bRpm > aRpm) return "b";
  return "tie";
}

/* ---------- Generic comparison helpers ---------- */

/**
 * Compare a "higher is better" stat (mag size, damage, fire rate
 * RPM in raw form). Returns "a" / "b" / "tie".
 */
export function compareHigherWins(a: number, b: number): "a" | "b" | "tie" {
  if (a > b) return "a";
  if (b > a) return "b";
  return "tie";
}

/**
 * Compare a "lower is better" stat (reload time). Same return shape.
 */
export function compareLowerWins(a: number, b: number): "a" | "b" | "tie" {
  if (a < b && a > 0) return "a";
  if (b < a && b > 0) return "b";
  // 0 reload is suspect — typically means missing data, not "instant
  // reload." Treat as tie when comparing to a positive value, so a
  // missing-data gun doesn't appear to "win" reload comparisons.
  return "tie";
}

function parseBoolish(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "true" || v === "yes" || v === "1";
}
