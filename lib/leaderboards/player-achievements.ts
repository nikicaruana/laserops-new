/**
 * lib/leaderboards/player-achievements.ts
 * --------------------------------------------------------------------
 * Aggregates every ranked placement a single player holds across the
 * competitive surfaces, for the Player Stats -> Achievements tab. Reuses the
 * cached, player-agnostic board data (see hall-of-fame-cached) and filters to
 * the player, recording each placing + a link to where it's shown. Visible for
 * any player (not own-only).
 *
 * Sections (in display order):
 *   1. Season Champion            – top-2 per completed-season challenge
 *   2. Current Season Challenges  – top-10 in the active season's challenges
 *   3. Leaderboard Rankings       – top-10 on the all-time cumulative boards
 *   4. All-Time Records           – top-3 single-game bests
 *   5. Weapon Mastery             – per gun: master + top-3 gun records
 *   6. Accolade Leaders           – top-3 most-earned per accolade
 *   7. Streak Leaders             – top-3 most-earned per streak
 */
import { createPublicClient } from "@/lib/supabase/public";
import { FALLBACK_PROFILE_PIC } from "@/lib/leaderboards/period-shared";
import {
  getCachedHallOfFameChampions,
  getCachedAllTimeRecords,
  getCachedWeaponMasters,
  getCachedAccoladeLeaders,
  getCachedStreakLeaders,
  getCachedPeriodRows,
  getCachedXpLevels,
  getCachedCurrentSeasonChallenges,
} from "@/lib/leaderboards/hall-of-fame-cached";
import { aggregateKills } from "@/lib/leaderboards/kills";
import { aggregateScore } from "@/lib/leaderboards/score";
import { aggregateDamage } from "@/lib/leaderboards/damage";
import { aggregateAccuracy } from "@/lib/leaderboards/accuracy";
import { aggregateMatchRoundWins } from "@/lib/leaderboards/match-round-wins";

const HOF = "/player-portal/leaderboards/hall-of-fame";
const HREF = {
  season: `${HOF}?tab=season-champions`,
  records: `${HOF}?tab=all-time-records`,
  weapons: `${HOF}?tab=weapon-masters`,
  accolades: `${HOF}?tab=accolade-leaders`,
  streaks: `${HOF}?tab=streak-leaders`,
  leaderboards: "/player-portal/leaderboards/all-time",
  challenges: "/player-portal/leaderboards/challenges",
};

const LEADERBOARD_TOP = 10;

export type AchievementItem = {
  rank: number;
  label: string;
  detail?: string;
  /** Where this placing is shown in full. */
  href: string;
  /** Optional badge/icon (accolade or streak) – a Cloudinary URL. */
  imageUrl?: string;
};

export type WeaponAchievement = {
  weaponName: string;
  imageUrl: string;
  /** Whether the viewed player is this gun's overall Weapon Master. */
  isMaster: boolean;
  /** Who holds the overall Weapon Master (highest career score), or "". */
  masterNickname: string;
  /** e.g. "16,585 total score" – the master's career score. */
  masterDetail?: string;
  items: AchievementItem[];
  href: string;
};

export type AchievementSection =
  | { kind: "list"; key: string; title: string; blurb: string; href: string; items: AchievementItem[] }
  | { kind: "weapons"; key: string; title: string; blurb: string; href: string; weapons: WeaponAchievement[] };

export type PlayerAchievements = {
  nickname: string;
  profilePicUrl: string;
  totalCount: number;
  sections: AchievementSection[];
};

export async function getPlayerAchievements(opsTag: string): Promise<PlayerAchievements | null> {
  const key = opsTag.trim().toLowerCase();
  if (key === "") return null;
  const match = (n: string | null | undefined) => (n ?? "").trim().toLowerCase() === key;

  const sb = createPublicClient();
  const [{ data: life }, champions, currentSeason, allTimeRecords, weaponMasters, accoladeLeaders, streakLeaders, periodRows, xpLevels] =
    await Promise.all([
      sb.from("player_stats_lifetime").select("nickname, profile_pic_url").ilike("nickname", opsTag).maybeSingle(),
      getCachedHallOfFameChampions().catch(() => []),
      getCachedCurrentSeasonChallenges().catch(() => null),
      getCachedAllTimeRecords().catch(() => []),
      getCachedWeaponMasters().catch(() => []),
      getCachedAccoladeLeaders().catch(() => []),
      getCachedStreakLeaders().catch(() => []),
      getCachedPeriodRows().catch(() => []),
      getCachedXpLevels().catch(() => []),
    ]);

  const lifeRow = life as { nickname: string | null; profile_pic_url: string | null } | null;
  let displayNick = (lifeRow?.nickname ?? "").trim() || opsTag.trim();
  const profilePicUrl = (lifeRow?.profile_pic_url ?? "").trim() || FALLBACK_PROFILE_PIC;

  const byRank = (a: AchievementItem, b: AchievementItem) => a.rank - b.rank || a.label.localeCompare(b.label);

  // 1. Season Champion (completed seasons, top-2).
  const season: AchievementItem[] = [];
  for (const s of champions) {
    for (const c of s.challenges) {
      const e = c.top.find((t) => match(t.nickname));
      if (e) {
        displayNick = e.nickname;
        season.push({ rank: e.rank, label: `${s.seasonName} · ${c.name}`, detail: `${e.formatted} ${c.metricLabel}`.trim(), href: HREF.season });
      }
    }
  }

  // 2. Current Season Challenges (active season, top-10).
  const currentSeasonItems: AchievementItem[] = [];
  if (currentSeason) {
    for (const c of currentSeason.challenges) {
      const e = c.top.find((t) => match(t.nickname) && t.rank <= LEADERBOARD_TOP);
      if (e) {
        displayNick = e.nickname;
        currentSeasonItems.push({ rank: e.rank, label: c.name, detail: `${e.formatted} ${c.metricLabel}`.trim(), href: HREF.challenges });
      }
    }
  }

  // 3. All-time cumulative leaderboards (top-10).
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
      leaderboards.push({ rank: e.rank, label: b.label, href: HREF.leaderboards });
    }
  }

  // 4. All-Time Records (top-3).
  const records: AchievementItem[] = [];
  for (const cat of allTimeRecords) {
    const e = cat.entries.find((x) => match(x.nickname));
    if (e) {
      displayNick = e.nickname;
      records.push({ rank: e.rank, label: cat.label, detail: e.formatted, href: HREF.records });
    }
  }

  // 5. Weapon Mastery – grouped per gun (master + top-3 gun records).
  const weapons: WeaponAchievement[] = [];
  for (const w of weaponMasters) {
    const isMaster = !!(w.master && match(w.master.nickname));
    const items: AchievementItem[] = [];
    for (const cat of w.categories) {
      const e = cat.entries.find((x) => match(x.nickname));
      if (e) {
        displayNick = e.nickname;
        items.push({ rank: e.rank, label: cat.label, detail: e.formatted, href: HREF.weapons });
      }
    }
    if (isMaster || items.length > 0) {
      if (isMaster && w.master) displayNick = w.master.nickname;
      weapons.push({
        weaponName: w.weaponName,
        imageUrl: w.imageUrl,
        isMaster,
        // Always surface the overall Weapon Master (highest career score), even
        // when it isn't the viewed player, as context for the gun.
        masterNickname: w.master?.nickname ?? "",
        masterDetail: w.master ? `${w.master.formatted} total score` : undefined,
        items: items.sort(byRank),
        href: HREF.weapons,
      });
    }
  }

  // 6. Accolade Leaders (top-3) – with badge image.
  const accolades: AchievementItem[] = [];
  for (const a of accoladeLeaders) {
    const e = a.entries.find((x) => match(x.nickname));
    if (e) {
      displayNick = e.nickname;
      accolades.push({ rank: e.rank, label: a.name, detail: `×${e.count.toLocaleString("en-US")}`, href: HREF.accolades, imageUrl: a.iconPath || undefined });
    }
  }

  // 7. Streak Leaders (top-3) – with badge image.
  const streaks: AchievementItem[] = [];
  for (const st of streakLeaders) {
    const e = st.entries.find((x) => match(x.nickname));
    if (e) {
      displayNick = e.nickname;
      streaks.push({ rank: e.rank, label: st.name, detail: `×${e.count.toLocaleString("en-US")}`, href: HREF.streaks, imageUrl: st.badgeUrl || undefined });
    }
  }

  const weaponCount = weapons.reduce((n, w) => n + w.items.length + (w.isMaster ? 1 : 0), 0);
  const totalCount =
    season.length + currentSeasonItems.length + leaderboards.length + records.length + weaponCount + accolades.length + streaks.length;

  const sections: AchievementSection[] = [];
  const pushList = (key: string, title: string, blurb: string, href: string, items: AchievementItem[]) => {
    if (items.length > 0) sections.push({ kind: "list", key, title, blurb, href, items: items.sort(byRank) });
  };
  pushList("season", "Season Champion", "Top-2 finishes in a completed-season challenge.", HREF.season, season);
  pushList("current-season", "Current Season Challenges", "Top-10 in the active season's challenges.", HREF.challenges, currentSeasonItems);
  pushList("leaderboards", "All-Time Leaderboard Rankings", "Top-10 placings on the all-time leaderboards.", HREF.leaderboards, leaderboards);
  pushList("records", "All-Time Records", "Best single-game performances ever recorded.", HREF.records, records);
  if (weapons.length > 0) {
    sections.push({ kind: "weapons", key: "weapons", title: "Weapon Mastery", blurb: "Tap a weapon to see its mastery and records.", href: HREF.weapons, weapons });
  }
  pushList("accolades", "Accolade Leaders", "Most-earned match accolades.", HREF.accolades, accolades);
  pushList("streaks", "Streak Leaders", "Most-earned in-game streaks.", HREF.streaks, streaks);

  return { nickname: displayNick, profilePicUrl, totalCount, sections };
}
