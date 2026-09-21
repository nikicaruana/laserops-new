/**
 * Bundled Match Report v2 (Beta) reports for the live site. Each is a complete
 * precomputed MatchReport produced offline by scripts/build-live-report.ts, so
 * the live site renders results only (no parsing/config fetching). Add a new
 * match by importing its .report.json here.
 */
import type { MatchReport } from "@/lib/match-report-v2/report-types";
import lo_2026_27 from "./LO-2026-27.report.json";
import lo_2026_28 from "./LO-2026-28.report.json";
import lo_2026_29 from "./LO-2026-29.report.json";
import lo_2026_30 from "./LO-2026-30.report.json";
import lo_2026_31 from "./LO-2026-31.report.json";

// Newest first — REPORTS[0] is the default shown when no ?match= is given.
export const REPORTS: MatchReport[] = [
  lo_2026_31 as unknown as MatchReport,
  lo_2026_30 as unknown as MatchReport,
  lo_2026_29 as unknown as MatchReport,
  lo_2026_28 as unknown as MatchReport,
  lo_2026_27 as unknown as MatchReport,
];

export function listReports(): { matchId: string; label: string }[] {
  return REPORTS.map((r) => ({ matchId: r.game.matchId, label: r.label ?? r.game.matchId }));
}

export function getReport(matchId: string | undefined): MatchReport | null {
  if (!matchId) return REPORTS[0] ?? null;
  return REPORTS.find((r) => r.game.matchId === matchId) ?? REPORTS[0] ?? null;
}
