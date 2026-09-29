/**
 * lib/leaderboards/player-achievements.ts
 * --------------------------------------------------------------------
 * Aggregates every ranked placement a single player holds across the
 * competitive surfaces, for the Player Stats -> Achievements tab. Reuses the
 * exact ranking logic each surface uses (Hall of Fame functions + the all-time
 * leaderboard aggregators), then filters to the player and records their
 * placing. Visible for any player (not own-only).
 *
 * Sources:
 *   1. Season Champion   – top-2 finishes per season challenge
 *   2. Leaderboards      – top-10 on the all-time cumulative boards
 *   3. All-Time Records  – top-3 single-game bests
 *   4. Weapon Mastery    – weapon master + top-3 single-game gun records
 *   5. Accolade Leaders  – top-3 most-earned per accolade
 *   6. Streak Leaders    – top-3 most-earned per streak
 */
import {
  getCachedHallOfFameChampions,
  getCachedAllTimeRecords,
  getCachedWeaponMasters,
  getCachedAccoladeLeaders,
  getCachedStreakLeaders,
  getCachedPeriodRows,
  getCachedXpLevels,
} from "@/lib/leaderboards/hall-of-fame-cached";
import { aggregateKills } from "@/lib/leaderboards/kills";
import { aggregateScore } from "@/lib/leaderboards/score";
import { aggregateDamage } from "@/lib/leaderboards/damage";
import { aggregateAccuracy } from "@/lib/leaderboards/accuracy";
import { aggregateMatchRoundWins } from "@/lib/leaderboards/match-round-wins";

export type AchievementItem = {
  /** Placing, 1-indexed (1 = best). */
  rank: number;
  /** What was placed in, e.g. "Kills", "Season 1 · Most Captures", "MVP". */
  label: string;
  /** Optional value/context, e.g. "1,234", "×12", "58%". */
  detail?: string;
};

export type AchievementGroup = {
  key: string;
  title: string;
  blurb: string;
  items: AchievementItem[];
};

export type PlayerAchievements = {
  nickname: string;
  totalCount: number;
  groups: AchievementGroup[];
};

const LEADERBOARD_TOP = 10;

export async function getPlayerAchievements(
  opsTag: string,
): Promise<PlayerAchievements | null> {
  const key = opsTag.trim().toLowerCase();
  if (key === "") return null;
  const match = (n: string | null | undefined) => (n ?? "").trim().toLowerCase() === key;

  // All sources are cached, player-agnostic boards; we filter to the player here.
  const [champions, allTimeRecords, weaponMasters, accoladeLeaders, streakLeaders, periodRows, xpLevels] =
    await Promise.all([
      getCachedHallOfFameChampions().catch(() => []),
      getCachedAllTimeRecords().catch(() => []),
      getCachedWeaponMasters().catch(() => []),
      getCachedAccoladeLeaders().catch(() => []),
      getCachedStreakLeaders().catch(() => []),
      getCachedPeriodRows().catch(() => []),
      getCachedXpLevels().catch(() => []),
    ]);

  let displayNick = opsTag.trim();

  // 1. Season Champion – top-2 per challenge.
  const season: AchievementItem[] = [];
  for (const s of champions) {
    for (const c of s.challenges) {
      const e = c.top.find((t) => match(t.nickname));
      if (e) {
        displayNick = e.nickname;
        season.push({ rank: e.rank, label: `${s.seasonName} · ${c.name}`, detail: `${e.formatted} ${c.metricLabel}`.trim() });
      }
    }
  }

  // 2. All-time cumulative leaderboards – top-10.
  const boards: { label: string; rows: { rank: number; nickname: string }[] }[] = [
    { label: "XP & Levels", rows: xpLevels },
    { label: "Match & Round Wins", rows: aggregateMatchRoundWins(periodRows) },
    { label: "Score", rows: aggregateScore(periodRows) },
    { label: "Kills", rows: aggregateKills(periodRows) },
    { label: "Damage", rows: aggregateDamage(periodRows) },
    { label: "Accuracy", rows: aggregateAccuracy(periodRows) },
  ];
  const leaderboards: AchievementItem[] = [];
  for (const b of boards) {
    const e = b.rows.find((r) => match(r.nickname) && r.rank <= LEADERBOARD_TOP);
    if (e) {
      displayNick = e.nickname;
      leaderboards.push({ rank: e.rank, label: b.label });
    }
  }

  // 3. All-Time Records – top-3 single-game bests.
  const records: AchievementItem[] = [];
  for (const cat of allTimeRecords) {
    const e = cat.entries.find((x) => match(x.nickname));
    if (e) {
      displayNick = e.nickname;
      records.push({ rank: e.rank, label: cat.label, detail: e.formatted });
    }
  }

  // 4. Weapon Mastery – career master + top-3 single-game gun records.
  const weaponsAch: AchievementItem[] = [];
  for (const w of weaponMasters) {
    if (w.master && match(w.master.nickname)) {
      displayNick = w.master.nickname;
      weaponsAch.push({ rank: 1, label: `${w.weaponName} · Weapon Master`, detail: `${w.master.formatted} career score` });
    }
    for (const cat of w.categories) {
      const e = cat.entries.find((x) => match(x.nickname));
      if (e) {
        displayNick = e.nickname;
        weaponsAch.push({ rank: e.rank, label: `${w.weaponName} · ${cat.label}`, detail: e.formatted });
      }
    }
  }

  // 5. Accolade Leaders – top-3 most-earned per accolade.
  const accolades: AchievementItem[] = [];
  for (const a of accoladeLeaders) {
    const e = a.entries.find((x) => match(x.nickname));
    if (e) {
      displayNick = e.nickname;
      accolades.push({ rank: e.rank, label: a.name, detail: `×${e.count.toLocaleString("en-US")}` });
    }
  }

  // 6. Streak Leaders – top-3 most-earned per streak.
  const streaks: AchievementItem[] = [];
  for (const st of streakLeaders) {
    const e = st.entries.find((x) => match(x.nickname));
    if (e) {
      displayNick = e.nickname;
      streaks.push({ rank: e.rank, label: st.name, detail: `×${e.count.toLocaleString("en-US")}` });
    }
  }

  const byRank = (a: AchievementItem, b: AchievementItem) =>
    a.rank - b.rank || a.label.localeCompare(b.label);

  const groups: AchievementGroup[] = [
    { key: "season", title: "Season Champion", blurb: "Top-2 finishes in a season challenge.", items: season.sort(byRank) },
    { key: "leaderboards", title: "Leaderboard Rankings", blurb: "Top-10 placings on the all-time leaderboards.", items: leaderboards.sort(byRank) },
    { key: "records", title: "All-Time Records", blurb: "Best single-game performances ever recorded.", items: records.sort(byRank) },
    { key: "weapons", title: "Weapon Mastery", blurb: "Weapon masters and single-game weapon records.", items: weaponsAch.sort(byRank) },
    { key: "accolades", title: "Accolade Leaders", blurb: "Most-earned match accolades.", items: accolades.sort(byRank) },
    { key: "streaks", title: "Streak Leaders", blurb: "Most-earned in-game streaks.", items: streaks.sort(byRank) },
  ];

  const totalCount = groups.reduce((n, g) => n + g.items.length, 0);
  return { nickname: displayNick, totalCount, groups };
}
