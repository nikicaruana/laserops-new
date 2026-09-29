/**
 * lib/leaderboards/supabase-hall-of-fame.ts
 * --------------------------------------------------------------------
 * Supabase-backed Hall of Fame. Emits the existing shapes from
 * lib/leaderboards/hall-of-fame so the HoF page renders unchanged.
 *
 *   getHallOfFameChampions -> SeasonChampions[]  (reuses the challenge
 *       standings adapter over completed seasons)
 *   getAllTimeRecords      -> RecordCategory[]    (v_hof_all_time_records)
 *   getAccoladeLeaders     -> AccoladeLeaders[]   (v_hof_accolade_leaders)
 *   getWeaponMasters       -> WeaponRecords[]     (player_armory master +
 *       match_player_aggregate single-game records, joined to the weapon
 *       catalogue)
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Weapon } from "@/lib/cms/weapons";
import type {
  RecordCategory,
  RecordEntry,
  WeaponRecords,
  WeaponMaster,
  SeasonChampions,
  SeasonChampionChallenge,
  AccoladeLeaders,
  StreakLeaders,
} from "@/lib/leaderboards/hall-of-fame";
import { accoladeKey } from "@/lib/cms/accolades";
import { isUnclaimedNickname } from "@/lib/leaderboards/unclaimed";
import { FALLBACK_PROFILE_PIC } from "@/lib/leaderboards/period-shared";
import {
  getSeasonsFromSupabase,
  getChallengesFromSupabase,
  getSeasonChallengeData,
} from "@/lib/leaderboards/supabase-challenges";

/* ─── Formatters ────────────────────────────────────────────────────── */
const fmtInt = (v: number): string => Math.round(v).toLocaleString("en-US");
const fmtRatio = (v: number): string => v.toFixed(2);
const fmtDuration = (v: number): string => {
  const t = Math.round(v);
  const m = Math.floor(t / 60);
  const sec = t % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};
const fmtPercent = (v: number): string => `${Math.round(v * 100)}%`;
const fmtNumber = (v: number): string =>
  Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(2);

/* ─── 2. All-Time Records ───────────────────────────────────────────── */

// Display metadata per record. `record` keys match v_hof_all_time_records's
// `record` column; the view already applied eligibility gates (K/D min 20
// kills, accuracy min 250 shots), so this layer only labels + formats.
const RECORD_META: {
  record: string;
  key: string;
  note?: string;
  format: (v: number) => string;
}[] = [
  { record: "Highest Score", key: "score", format: fmtInt },
  { record: "Most Kills", key: "kills", format: fmtInt },
  { record: "Best K/D", key: "kd", note: "Min. 20 kills in a game", format: fmtRatio },
  { record: "Highest Accuracy", key: "accuracy", note: "Min. 250 shots in a game", format: fmtPercent },
  { record: "Most Damage", key: "damage", format: fmtInt },
  { record: "Highest Match Rating", key: "rating", format: fmtRatio },
  { record: "Most Caps", key: "caps", format: fmtInt },
  { record: "Longest Capture Time", key: "holdSeconds", format: fmtDuration },
];

type RecordRow = {
  record: string | null;
  ops_tag: string | null;
  profile_pic_url: string | null;
  value: number | null;
  match_code: string | null;
  rk: number | null;
};

export async function getAllTimeRecords(
  supabase: SupabaseClient,
): Promise<RecordCategory[]> {
  const { data } = await supabase
    .from("v_hof_all_time_records")
    .select("record, ops_tag, profile_pic_url, value, match_code, rk");

  const byRecord = new Map<string, RecordRow[]>();
  for (const r of (data ?? []) as RecordRow[]) {
    if (!r.record) continue;
    if (isUnclaimedNickname((r.ops_tag ?? "").trim())) continue;
    const arr = byRecord.get(r.record);
    if (arr) arr.push(r);
    else byRecord.set(r.record, [r]);
  }

  return RECORD_META.map((meta): RecordCategory => {
    const rows = (byRecord.get(meta.record) ?? [])
      .slice()
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      .slice(0, 3);
    const entries: RecordEntry[] = rows.map((r, i) => ({
      rank: i + 1,
      nickname: (r.ops_tag ?? "").trim(),
      profilePicUrl: (r.profile_pic_url ?? "").trim() || FALLBACK_PROFILE_PIC,
      value: r.value ?? 0,
      formatted: meta.format(r.value ?? 0),
      matchId: r.match_code ?? "",
    }));
    return { key: meta.key, label: meta.record, note: meta.note, entries };
  });
}

/* ─── 4. Accolade Leaders ───────────────────────────────────────────── */

type AccoladeRow = {
  accolade: string | null;
  ops_tag: string | null;
  profile_pic_url: string | null;
  times_won: number | null;
};

export async function getAccoladeLeaders(
  supabase: SupabaseClient,
): Promise<AccoladeLeaders[]> {
  const [defsRes, leadersRes] = await Promise.all([
    supabase
      .from("accolade_definitions")
      .select("name, description, badge_url, xp")
      .eq("is_active", true)
      .order("xp", { ascending: false })
      .order("name"),
    supabase
      .from("v_hof_accolade_leaders")
      .select("accolade, ops_tag, profile_pic_url, times_won"),
  ]);

  // Key by accoladeKey (case/separator-insensitive) so catalogue names match
  // the view's stored names even when they differ in casing/spelling – e.g.
  // catalogue "Spray N Pray" vs view "Spray n Pray".
  const byAccolade = new Map<string, AccoladeRow[]>();
  for (const r of (leadersRes.data ?? []) as AccoladeRow[]) {
    if (!r.accolade) continue;
    if (isUnclaimedNickname((r.ops_tag ?? "").trim())) continue;
    const key = accoladeKey(r.accolade);
    const arr = byAccolade.get(key);
    if (arr) arr.push(r);
    else byAccolade.set(key, [r]);
  }

  // Catalogue comes from accolade_definitions (admin-authoritative), so newer
  // accolades like CAP-Tain and Fortress appear automatically. Ordered by XP.
  const defs = ((defsRes.data ?? []) as {
    name: string | null;
    description: string | null;
    badge_url: string | null;
    xp: number | null;
  }[]).filter((d) => (d.name ?? "").trim() !== "");

  return defs.map((d): AccoladeLeaders => {
    const name = (d.name ?? "").trim();
    const rows = (byAccolade.get(accoladeKey(name)) ?? [])
      .slice()
      .sort((a, b) => (b.times_won ?? 0) - (a.times_won ?? 0))
      .slice(0, 3);
    return {
      name,
      description: (d.description ?? "").trim(),
      iconPath: (d.badge_url ?? "").trim(),
      tier: d.xp ?? 0,
      entries: rows.map((r, i) => ({
        rank: i + 1,
        nickname: (r.ops_tag ?? "").trim(),
        profilePicUrl: (r.profile_pic_url ?? "").trim() || FALLBACK_PROFILE_PIC,
        count: r.times_won ?? 0,
      })),
    };
  });
}

/* ─── 5. Streak Leaders ─────────────────────────── */

type StreakRow = {
  streak_key: string | null;
  ops_tag: string | null;
  profile_pic_url: string | null;
  times_earned: number | null;
};

// Per streak, the top 3 players by total times earned. Streak names, points,
// badge art and order are admin-authoritative (streak_definitions), so this is
// the single source the leaderboard, match report and accolades page share.
export async function getStreakLeaders(
  supabase: SupabaseClient,
): Promise<StreakLeaders[]> {
  const [defsRes, leadersRes] = await Promise.all([
    supabase
      .from("streak_definitions")
      .select("streak_key, name, description, badge_url, points, tier")
      .eq("is_active", true),
    supabase
      .from("v_hof_streak_leaders")
      .select("streak_key, ops_tag, profile_pic_url, times_earned"),
  ]);

  const byKey = new Map<string, StreakRow[]>();
  for (const r of (leadersRes.data ?? []) as StreakRow[]) {
    const key = (r.streak_key ?? "").trim();
    if (!key) continue;
    if (isUnclaimedNickname((r.ops_tag ?? "").trim())) continue;
    const arr = byKey.get(key);
    if (arr) arr.push(r);
    else byKey.set(key, [r]);
  }

  const defs = ((defsRes.data ?? []) as {
    streak_key: string | null;
    name: string | null;
    description: string | null;
    badge_url: string | null;
    points: number | null;
    tier: number | null;
  }[]).filter((d) => (d.streak_key ?? "").trim() !== "");

  // Strongest streaks first (tier, then points), matching the streaks page.
  defs.sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0) || (b.points ?? 0) - (a.points ?? 0));

  return defs.map((d): StreakLeaders => {
    const key = (d.streak_key ?? "").trim();
    const rows = (byKey.get(key) ?? [])
      .slice()
      .sort((a, b) => (b.times_earned ?? 0) - (a.times_earned ?? 0))
      .slice(0, 3);
    return {
      streakKey: key,
      name: (d.name ?? key).trim(),
      description: (d.description ?? "").trim(),
      badgeUrl: (d.badge_url ?? "").trim(),
      points: d.points ?? 0,
      entries: rows.map((r, i) => ({
        rank: i + 1,
        nickname: (r.ops_tag ?? "").trim(),
        profilePicUrl: (r.profile_pic_url ?? "").trim() || FALLBACK_PROFILE_PIC,
        count: r.times_earned ?? 0,
      })),
    };
  });
}
/* ─── 1. Season Champions ───────────────────────────────────────────── */

function humanizeMetric(metric: string): string {
  return metric
    .replace(/^(Total_|Season_|Max_|LaserOps_|Player)/i, "")
    .replace(/_/g, " ")
    .trim();
}

export async function getHallOfFameChampions(
  supabase: SupabaseClient,
): Promise<SeasonChampions[]> {
  const seasons = await getSeasonsFromSupabase(supabase);
  const completed = seasons
    .filter((s) => s.status === "completed")
    .sort((a, b) => b.number - a.number);

  const out: SeasonChampions[] = [];
  for (const season of completed) {
    const challenges = await getChallengesFromSupabase(supabase, season.number);
    if (challenges.length === 0) continue;
    const data = await getSeasonChallengeData(supabase, season, challenges);

    const champChallenges: SeasonChampionChallenge[] = data
      .filter((cd) => cd.entries.length > 0)
      .map((cd) => ({
        challengeNumber: cd.challenge.challengeNumber,
        name: cd.challenge.name,
        description: cd.challenge.description,
        metricLabel:
          cd.challenge.sourceMode === "gun_threshold_count"
            ? "guns"
            : humanizeMetric(cd.challenge.metric),
        top: cd.entries.slice(0, 2).map((e) => ({
          rank: e.rank,
          nickname: e.nickname,
          profilePicUrl: e.profilePicUrl,
          value: e.metricValue,
          formatted: fmtNumber(e.metricValue),
        })),
      }))
      .sort((a, b) => a.challengeNumber - b.challengeNumber);

    if (champChallenges.length > 0) {
      out.push({
        seasonNumber: season.number,
        seasonName: season.name,
        challenges: champChallenges,
      });
    }
  }
  return out;
}

/* ─── 3. Weapon Masters ─────────────────────────────────────────────── */

// Single-game gun record specs. Same metrics as the Sheets HoF.
const WEAPON_SPECS: {
  key: string;
  label: string;
  note?: string;
  value: (r: GunGameRow) => number;
  eligible?: (r: GunGameRow) => boolean;
  format: (v: number) => string;
}[] = [
  { key: "score", label: "Top Score", value: (r) => r.score, format: fmtInt },
  { key: "kills", label: "Most Kills", value: (r) => r.frags, format: fmtInt },
  { key: "kd", label: "Best K/D", note: "Min. 20 kills", value: (r) => r.kd, eligible: (r) => r.frags > 20, format: fmtRatio },
  { key: "accuracy", label: "Best Accuracy", note: "Min. 250 shots", value: (r) => r.accuracy, eligible: (r) => r.shots > 250, format: fmtPercent },
  { key: "damage", label: "Most Damage", value: (r) => r.damage, format: fmtInt },
  { key: "rating", label: "Best Match Rating", value: (r) => r.matchRating, format: fmtRatio },
  { key: "caps", label: "Most Caps", value: (r) => r.captures, format: fmtInt },
  { key: "holdSeconds", label: "Longest Capture Time", value: (r) => r.holdSeconds, format: fmtDuration },
];

type GunGameRow = {
  gun: string;
  nickname: string;
  profilePicUrl: string;
  matchId: string;
  score: number;
  frags: number;
  kd: number;
  accuracy: number;
  damage: number;
  matchRating: number;
  shots: number;
  captures: number;
  holdSeconds: number;
};

function topThreeGun(
  rows: GunGameRow[],
  spec: (typeof WEAPON_SPECS)[number],
): RecordEntry[] {
  const sorted = rows
    .filter((r) => (spec.eligible ? spec.eligible(r) : true))
    .map((r) => ({ r, v: spec.value(r) }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v);

  const seen = new Set<string>();
  const deduped = sorted.filter((x) => {
    const key = x.r.nickname.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.slice(0, 3).map((x, i) => ({
    rank: i + 1,
    nickname: x.r.nickname,
    profilePicUrl: x.r.profilePicUrl,
    value: x.v,
    formatted: spec.format(x.v),
    matchId: x.r.matchId,
  }));
}

export async function getWeaponMasters(
  supabase: SupabaseClient,
  weapons: Weapon[],
): Promise<WeaponRecords[]> {
  const [armoryRes, mpaRes, lifeRes, matchRes] = await Promise.all([
    supabase.from("player_armory").select("gun_name, nickname, profile_pic_url, score_total"),
    supabase
      .from("match_player_aggregate")
      .select("gun_used, score, frags, kd, accuracy, damage, match_rating, shots, captures, hold_seconds, account_id, match_id"),
    supabase.from("player_stats_lifetime").select("account_id, nickname, profile_pic_url"),
    supabase.from("matches").select("id, match_code"),
  ]);

  // Career master per gun = highest player_armory score_total.
  const masterByGun = new Map<string, WeaponMaster>();
  for (const a of (armoryRes.data ?? []) as {
    gun_name: string | null;
    nickname: string | null;
    profile_pic_url: string | null;
    score_total: number | null;
  }[]) {
    const gun = (a.gun_name ?? "").trim().toLowerCase();
    const nick = (a.nickname ?? "").trim();
    const score = a.score_total ?? 0;
    if (gun === "" || score <= 0 || nick === "" || isUnclaimedNickname(nick)) continue;
    const existing = masterByGun.get(gun);
    if (!existing || score > existing.scoreTotal) {
      masterByGun.set(gun, {
        nickname: nick,
        profilePicUrl: (a.profile_pic_url ?? "").trim() || FALLBACK_PROFILE_PIC,
        scoreTotal: score,
        formatted: fmtInt(score),
      });
    }
  }

  // account_id -> display, match_id -> match_code.
  const lifeByAccount = new Map<string, { nickname: string; pic: string }>();
  for (const l of (lifeRes.data ?? []) as {
    account_id: string;
    nickname: string | null;
    profile_pic_url: string | null;
  }[]) {
    lifeByAccount.set(l.account_id, {
      nickname: (l.nickname ?? "").trim(),
      pic: (l.profile_pic_url ?? "").trim() || FALLBACK_PROFILE_PIC,
    });
  }
  const codeByMatch = new Map<string, string>();
  for (const m of (matchRes.data ?? []) as { id: string; match_code: string | null }[]) {
    codeByMatch.set(m.id, m.match_code ?? "");
  }

  // Single-game gun rows grouped by gun (lowercased).
  const rowsByGun = new Map<string, GunGameRow[]>();
  for (const r of (mpaRes.data ?? []) as {
    gun_used: string | null;
    score: number | null;
    frags: number | null;
    kd: number | null;
    accuracy: number | null;
    damage: number | null;
    match_rating: number | null;
    shots: number | null;
    captures: number | null;
    hold_seconds: number | null;
    account_id: string | null;
    match_id: string | null;
  }[]) {
    const gun = (r.gun_used ?? "").trim().toLowerCase();
    if (gun === "" || !r.account_id) continue;
    const life = lifeByAccount.get(r.account_id);
    if (!life || life.nickname === "" || isUnclaimedNickname(life.nickname)) continue;
    const row: GunGameRow = {
      gun,
      nickname: life.nickname,
      profilePicUrl: life.pic,
      matchId: r.match_id ? codeByMatch.get(r.match_id) ?? "" : "",
      score: r.score ?? 0,
      frags: r.frags ?? 0,
      kd: r.kd ?? 0,
      accuracy: r.accuracy ?? 0,
      damage: r.damage ?? 0,
      matchRating: r.match_rating ?? 0,
      shots: r.shots ?? 0,
      captures: r.captures ?? 0,
      holdSeconds: r.hold_seconds ?? 0,
    };
    const arr = rowsByGun.get(gun);
    if (arr) arr.push(row);
    else rowsByGun.set(gun, [row]);
  }

  const out: WeaponRecords[] = [];
  for (const w of [...weapons].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const key = w.name.trim().toLowerCase();
    const gunRows = rowsByGun.get(key) ?? [];
    const master = masterByGun.get(key) ?? null;
    const categories = WEAPON_SPECS.map((spec) => ({
      key: spec.key,
      label: spec.label,
      note: spec.note,
      entries: topThreeGun(gunRows, spec),
    }));
    const hasAny = master !== null || categories.some((c) => c.entries.length > 0);
    if (!hasAny) continue;
    out.push({ weaponName: w.name, imageUrl: w.imageUrl, master, categories });
  }
  return out;
}
