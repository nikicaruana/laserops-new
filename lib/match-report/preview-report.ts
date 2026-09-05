/**
 * lib/match-report/preview-report.ts
 * --------------------------------------------------------------------
 * Builds the dummy match report (buildPreviewReport) using REAL config assets
 * pulled from Supabase (team badges, gun images, accolade badges, rank badges).
 * Shared by the admin match-report preview page and the story-image route so
 * both render identical sample data with real artwork.
 */
import { createClient } from "@/lib/supabase/server";
import { buildPreviewReport } from "@/lib/match-report/preview-data";
import { getRankByLevel, type RankLevel } from "@/lib/cms/ranking-system";
import { accoladeKey, type Accolade } from "@/lib/cms/accolades";
import type { MatchReport } from "@/lib/match-report/engine";

export async function buildPreviewReportFromDb(): Promise<MatchReport> {
  const supabase = await createClient();
  const [{ data: teamRows }, { data: gunRows }, { data: accRows }, { data: rankRows }] = await Promise.all([
    supabase.from("teams").select("colour, badge_url"),
    supabase.from("guns").select("name, image_url").order("sort_order", { nullsFirst: false }).limit(8),
    supabase.from("accolade_definitions").select("name, description, badge_url, xp").limit(50),
    supabase.from("rank_levels").select("level, rank_name, score_threshold, est_games, badge_url").order("level"),
  ]);

  const teamBadges: { Red?: string; Blue?: string } = {};
  for (const t of (teamRows ?? []) as { colour: string; badge_url: string | null }[]) {
    if (t.colour?.toLowerCase() === "red") teamBadges.Red = t.badge_url ?? "";
    if (t.colour?.toLowerCase() === "blue") teamBadges.Blue = t.badge_url ?? "";
  }
  const guns = ((gunRows ?? []) as { name: string; image_url: string | null }[]).map((g) => ({ name: g.name, image: g.image_url ?? "" }));
  const accolades: Accolade[] = ((accRows ?? []) as { name: string; description: string | null; badge_url: string | null; xp: number | null }[]).map((a) => ({
    name: a.name,
    key: accoladeKey(a.name),
    description: a.description ?? "",
    badgeUrl: a.badge_url ?? "",
    xp: a.xp ?? 0,
  }));
  const ranks: RankLevel[] = ((rankRows ?? []) as { level: number; rank_name: string | null; score_threshold: number | null; est_games: number | null; badge_url: string | null }[]).map((r) => ({
    level: r.level,
    rankName: r.rank_name ?? "",
    scoreThreshold: r.score_threshold ?? 0,
    estGames: r.est_games ?? 0,
    badgeUrl: r.badge_url ?? "",
  }));
  const rankBadgeByLevel = (lvl: number) => getRankByLevel(ranks, lvl)?.badgeUrl ?? "";

  return buildPreviewReport({ guns, teamBadges, ranks, rankBadgeByLevel, accolades });
}
