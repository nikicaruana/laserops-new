/**
 * lib/money.ts – shared EUR formatting.
 */
export function formatEur(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  const safe = typeof n === "number" && Number.isFinite(n) ? n : 0;
  // Thousands separators + exactly 2 decimals, e.g. €1,234.50.
  return `€${safe.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Euros -> integer cents (providers bill in minor units; avoids float drift). */
export function toCents(euros: number): number {
  return Math.round(euros * 100);
}
