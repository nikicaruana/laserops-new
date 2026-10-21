/**
 * lib/player-stats/radar.ts
 * --------------------------------------------------------------------
 * Data for the Compare-page radar (Kiviat) chart. Each of the 9 axes maps 1:1
 * to a player-rating component, and a player's position on an axis is their
 * PERCENTILE among the rated field for that stat (0 = bottom, 1 = top). Because
 * the rating star bands are percentile-based and identical on every axis (2* =
 * bottom 35%, 3* = 35-75%, 4* = 75-90%, 5* = top 10%), the band boundaries draw
 * as clean concentric rings. There is no 1* band in the rating system, so a
 * dummy 1* ring sits in the centre for scale context.
 *
 * Percentile (not raw value) is what gets plotted, so a single low-game outlier
 * can never blow out the scale, and a compared player who exceeds the field just
 * lands at the 1.0 edge.
 */
import type { ComparePlayerData } from "./compare";

const perRound = (total: number, rounds: number) => (rounds > 0 ? total / rounds : 0);
const mmss = (s: number) => `${Math.floor(s / 60)}m ${String(Math.round(s) % 60).padStart(2, "0")}s`;

export type RadarAxis = {
  key: string;
  /** Long label for the axis spoke. */
  label: string;
  /** Short label for tight layouts. */
  short: string;
  get: (p: ComparePlayerData) => number;
  fmt: (v: number) => string;
};

export const RADAR_AXES: RadarAxis[] = [
  { key: "matchRating", label: "Avg Match Rating", short: "Match Rating", get: (p) => p.matchRating, fmt: (v) => v.toFixed(2) },
  { key: "matchWin", label: "Match Win Rate", short: "Match Win", get: (p) => p.matchWinRatePct, fmt: (v) => `${Math.round(v)}%` },
  { key: "roundWin", label: "Round Win Rate", short: "Round Win", get: (p) => p.roundsWinRatePct, fmt: (v) => `${Math.round(v)}%` },
  { key: "kills", label: "Kills / Round", short: "Kills/Rd", get: (p) => perRound(p.killsTotal, p.roundsTotal), fmt: (v) => v.toFixed(2) },
  { key: "kd", label: "K/D Ratio", short: "K/D", get: (p) => p.kd, fmt: (v) => v.toFixed(2) },
  { key: "damage", label: "Damage / Round", short: "Dmg/Rd", get: (p) => perRound(p.damageTotal, p.roundsTotal), fmt: (v) => Math.round(v).toLocaleString("en-US") },
  { key: "caps", label: "Caps / Round", short: "Caps/Rd", get: (p) => perRound(p.capturesTotal, p.roundsTotal), fmt: (v) => v.toFixed(2) },
  { key: "hold", label: "Hold Time / Round", short: "Hold/Rd", get: (p) => perRound(p.holdTotal, p.roundsTotal), fmt: (v) => mmss(v) },
  { key: "accuracy", label: "Accuracy", short: "Accuracy", get: (p) => p.accuracyPct, fmt: (v) => `${v.toFixed(0)}%` },
];

/** Sorted-ascending field values per axis, taken from the RATED players only. */
export type RadarField = { sorted: Record<string, number[]> };

export function buildRadarField(players: ComparePlayerData[]): RadarField {
  const rated = players.filter((p) => p.ratingUnlocked);
  const sorted: Record<string, number[]> = {};
  for (const ax of RADAR_AXES) {
    sorted[ax.key] = rated.map(ax.get).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  }
  return { sorted };
}

/** Percentile of v within a sorted-ascending field: (below + ties/2) / n. */
export function percentileOf(v: number, sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0.5;
  let lt = 0, eq = 0;
  for (const x of sorted) { if (x < v) lt++; else if (x === v) eq++; }
  return Math.max(0, Math.min(1, (lt + eq / 2) / n));
}

export type RadarPoint = { key: string; label: string; short: string; raw: number; pct: number; fmt: string; band: string };

/** Which star band a percentile falls in (for the tooltip). No 1* in the system. */
export function bandOf(pct: number): string {
  if (pct >= 0.9) return "5★";
  if (pct >= 0.75) return "4★";
  if (pct >= 0.35) return "3★";
  return "2★";
}

export function radarPointsFor(p: ComparePlayerData, field: RadarField): RadarPoint[] {
  return RADAR_AXES.map((ax) => {
    const raw = ax.get(p);
    const pct = percentileOf(raw, field.sorted[ax.key]);
    return { key: ax.key, label: ax.label, short: ax.short, raw, pct, fmt: ax.fmt(raw), band: bandOf(pct) };
  });
}

// --- Geometry: percentile -> radius fraction (0..1) -------------------------
// A centre margin is reserved for the dummy 1* zone, so real data (percentile
// 0..1) occupies the outer part of the plot (the 2*..5* zones).
export const INNER_MARGIN = 0.14;
export const radiusForPct = (pct: number) => INNER_MARGIN + (1 - INNER_MARGIN) * Math.max(0, Math.min(1, pct));

/** Percentile positions of the band-boundary rings (inner 2* floor -> 5* top). */
export const BAND_RINGS: { pct: number; star: string }[] = [
  { pct: 0, star: "2★" },
  { pct: 0.35, star: "3★" },
  { pct: 0.75, star: "4★" },
  { pct: 0.9, star: "5★" },
  { pct: 1, star: "" },
];
