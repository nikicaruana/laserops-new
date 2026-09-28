/**
 * Bundled Match Report v2 artifacts. Each is produced by
 * scripts/build-match-report.ts from parsed round JSON. Add a new match by
 * building its JSON and importing it here.
 */
import type { MatchReportV2 } from "../types";
import lo_2026_27 from "./LO-2026-27.json";

export const REPORTS: MatchReportV2[] = [lo_2026_27 as unknown as MatchReportV2];

export function listReports(): { matchId: string; label: string }[] {
  return REPORTS.map((r) => ({ matchId: r.matchId, label: r.label }));
}

export function getReport(matchId: string | undefined): MatchReportV2 | null {
  if (!matchId) return REPORTS[0] ?? null;
  return REPORTS.find((r) => r.matchId === matchId) ?? null;
}
