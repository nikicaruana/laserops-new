/**
 * lib/money.ts – shared EUR formatting.
 */
export function formatEur(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  return `€${(typeof n === "number" && Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

/** Euros -> integer cents for Stripe (avoids float drift). */
export function toCents(euros: number): number {
  return Math.round(euros * 100);
}
