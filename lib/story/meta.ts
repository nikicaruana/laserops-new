/**
 * lib/story/meta.ts
 * --------------------------------------------------------------------
 * Lightweight, dependency-free metadata about the shareable story layouts.
 * Kept separate from the Satori renderer (app/api/story/_render.tsx) so client
 * components (share button, preview gallery) can import the template list
 * without pulling next/og JSX into their bundle.
 */
export type StoryTemplate = "personal" | "team" | "nemesis" | "xp";

export const STORY_TEMPLATES: { key: StoryTemplate; label: string; blurb: string }[] = [
  { key: "personal", label: "My Stats", blurb: "Your stats, streaks and accolades" },
  { key: "team", label: "Match Result", blurb: "Round wins and team breakdown" },
  { key: "nemesis", label: "Nemesis", blurb: "Your head-to-head rivalry" },
  { key: "xp", label: "XP & Level", blurb: "XP earned and level progress" },
];

export function isStoryTemplate(v: string): v is StoryTemplate {
  return v === "personal" || v === "team" || v === "nemesis" || v === "xp";
}

/** Overlay presets for the photo-story (a match photo + optional stats band). */
export type PhotoOverlay = "none" | "main" | "highlights" | "captures" | "result" | "accolade" | "streaks" | "identity";

export const PHOTO_OVERLAYS: { key: PhotoOverlay; label: string; blurb: string }[] = [
  { key: "main", label: "Main stats", blurb: "Score, Kills, Deaths, K/D + ranks" },
  { key: "highlights", label: "Highlights", blurb: "Your four best stats by rank" },
  { key: "captures", label: "Capture stats", blurb: "Score, captures, capture time" },
  { key: "result", label: "Match result", blurb: "Round wins + Victory / Defeat" },
  { key: "accolade", label: "Accolades", blurb: "Your accolade badges this match" },
  { key: "streaks", label: "Streaks", blurb: "Your best streaks + counts" },
  { key: "identity", label: "Identity", blurb: "Ops tag + level (no stats)" },
  { key: "none", label: "Photo only", blurb: "Just the photo + branding" },
];

export function isPhotoOverlay(v: string): v is PhotoOverlay {
  return PHOTO_OVERLAYS.some((o) => o.key === v);
}

/* ---- Live overlay preview data (so the composer can show the band while you
   position the photo, matching what the server bakes in) ---- */
import type { MatchReport, MatchPlayer } from "@/lib/match-report/engine";

export type OverlayStat = { label: string; value: string; rank: number };
export type OverlayBadge = { name: string; badgeUrl: string; count?: number };
export type OverlayData = {
  nickname: string;
  teamColor: string;
  level: number;
  rankBadgeUrl: string;
  matchDate: string;
  stats: OverlayStat[]; // Score, Kills, Deaths, K/D, Accuracy, Damage, Caps, Cap Time
  captureStats: OverlayStat[]; // Score, Captures, Cap Time
  result: { won: boolean; redRounds: number; blueRounds: number };
  accolades: OverlayBadge[];
  streaks: OverlayBadge[];
};

export function buildOverlayData(report: MatchReport, player: MatchPlayer): OverlayData {
  // Capture/objective stats are 0 for everyone when a game had no objective
  // scoring; drop them so a tied #1 of "0 Caps" never bubbles up as a best stat.
  const hasObjectivePlay = report.players.some((pl) => (pl.objCaps ?? 0) > 0 || (pl.capTime ?? 0) > 0);
  const stats: OverlayStat[] = [
    { label: "Score", value: player.score.toLocaleString("en-US"), rank: player.scoreRank },
    { label: "Kills", value: String(player.kills), rank: player.killsRank },
    { label: "Deaths", value: String(player.deaths), rank: player.deathsRank },
    { label: "K/D", value: player.kd.toFixed(2), rank: player.kdRank },
    { label: "Accuracy", value: `${Math.round(player.accuracy * 100)}%`, rank: player.accuracyRank },
    { label: "Damage", value: player.damage.toLocaleString("en-US"), rank: player.damageRank },
    ...(hasObjectivePlay
      ? [
          { label: "Caps", value: String(player.objCaps ?? 0), rank: player.objCapsRank ?? 0 },
          { label: "Cap Time", value: `${player.capTime ?? 0}s`, rank: player.capTimeRank ?? 0 },
        ]
      : []),
  ];
  const captureStats: OverlayStat[] = hasObjectivePlay
    ? [
        { label: "Score", value: player.score.toLocaleString("en-US"), rank: player.scoreRank },
        { label: "Captures", value: String(player.objCaps ?? 0), rank: player.objCapsRank ?? 0 },
        { label: "Cap Time", value: `${player.capTime ?? 0}s`, rank: player.capTimeRank ?? 0 },
      ]
    : [];
  const accolades: OverlayBadge[] = [...player.earnedAccolades]
    .sort((a, b) => (b.accolade.xp ?? 0) - (a.accolade.xp ?? 0))
    .map((e) => ({ name: e.accolade.name, badgeUrl: e.accolade.badgeUrl }));
  const streaks: OverlayBadge[] = [...(player.matchStreaks ?? [])]
    .sort((a, b) => b.points * b.count - a.points * a.count)
    .map((s) => ({ name: s.name, badgeUrl: s.badgeUrl, count: s.count }));
  return {
    nickname: player.nickname,
    teamColor: player.teamColor,
    level: player.level,
    rankBadgeUrl: player.rankBadgeUrl,
    matchDate: report.matchDate,
    stats,
    captureStats,
    result: { won: player.isWinner, redRounds: report.game.teams.red.roundWins, blueRounds: report.game.teams.blue.roundWins },
    accolades,
    streaks,
  };
}
