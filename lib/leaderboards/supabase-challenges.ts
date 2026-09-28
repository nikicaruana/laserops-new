/**
 * lib/leaderboards/supabase-challenges.ts
 * --------------------------------------------------------------------
 * Supabase-backed replacements for the seasonal-challenges data layer.
 * Emits the existing Season / Challenge / ChallengeWithEntries shapes so
 * the Challenges tab and Hall-of-Fame champions render unchanged.
 *
 *   getSeasonsFromSupabase     -> Season[]      (from seasons config table)
 *   getChallengesFromSupabase  -> Challenge[]   (from challenges config table)
 *   getSeasonChallengeData     -> ChallengeWithEntries[]
 *       from the precomputed season_challenge_standings read-model
 *       (refresh_season_challenge_standings()), enriched with level + rank
 *       badge from player_stats_lifetime + rank_levels.
 *
 * The heavy per-metric ranking that season-challenges.ts did in TS over
 * Google Sheets is already done in SQL, so this adapter just shapes rows.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Season, SeasonStatus } from "@/lib/cms/seasons";
import type {
  Challenge,
  ChallengeSourceMode,
} from "@/lib/cms/challenges";
import type {
  ChallengeEntry,
  ChallengeWithEntries,
} from "@/lib/leaderboards/season-challenges";
import { FALLBACK_PROFILE_PIC } from "@/lib/leaderboards/period-shared";
import { isUnclaimedNickname } from "@/lib/leaderboards/unclaimed";

/* ---------- seasons ---------- */

type SeasonRow = {
  season_number: number | null;
  name: string | null;
  starts_on: string | null; // "YYYY-MM-DD"
  ends_on: string | null;
  status: string | null;
  terms_and_conditions: string | null;
};

const ym = (d: string | null | undefined): string =>
  (d ?? "").slice(0, 7); // "YYYY-MM-DD" -> "YYYY-MM"

function enumerateMonths(start: string, end: string): string[] {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  if (!sy || !sm || !ey || !em) return [];
  const out: string[] = [];
  let year = sy;
  let month = sm;
  while (year < ey || (year === ey && month <= em)) {
    out.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    if (out.length > 240) break;
  }
  return out;
}

function normStatus(raw: string | null): SeasonStatus {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "active" || v === "completed" ? v : "upcoming";
}

export async function getSeasonsFromSupabase(
  supabase: SupabaseClient,
): Promise<Season[]> {
  const { data } = await supabase
    .from("seasons")
    .select("season_number, name, starts_on, ends_on, status, terms_and_conditions")
    .order("season_number");

  const seasons: Season[] = [];
  for (const r of (data ?? []) as SeasonRow[]) {
    if (r.season_number === null || !Number.isFinite(r.season_number)) continue;
    const startYearMonth = ym(r.starts_on);
    const endYearMonth = ym(r.ends_on);
    seasons.push({
      number: r.season_number,
      name: (r.name ?? "").trim(),
      startYearMonth,
      endYearMonth,
      status: normStatus(r.status),
      termsAndConditions: (r.terms_and_conditions ?? "").trim(),
      monthsInWindow: enumerateMonths(startYearMonth, endYearMonth),
    });
  }
  return seasons.sort((a, b) => a.number - b.number);
}

/* ---------- challenges ---------- */

type ChallengeRow = {
  season_number: number | null;
  challenge_number: number | null;
  challenge_name: string | null;
  description: string | null;
  prize: string | null;
  priority: number | null;
  source_mode: string | null;
  metric: string | null;
  tiebreak_1: string | null;
  tiebreak_2: string | null;
  top_n: number | null;
  prize_cutoff: number | null;
  threshold: number | null;
};

const VALID_MODES: ChallengeSourceMode[] = [
  "period_summed",
  "period_max",
  "match_top",
  "gun_threshold_count",
];

export async function getChallengesFromSupabase(
  supabase: SupabaseClient,
  seasonNumber?: number,
): Promise<Challenge[]> {
  let query = supabase
    .from("challenges")
    .select(
      "season_number, challenge_number, challenge_name, description, prize, priority, source_mode, metric, tiebreak_1, tiebreak_2, top_n, prize_cutoff, threshold",
    );
  if (seasonNumber !== undefined) query = query.eq("season_number", seasonNumber);

  const { data } = await query;

  const challenges: Challenge[] = [];
  for (const r of (data ?? []) as ChallengeRow[]) {
    if (r.season_number === null || r.challenge_number === null) continue;
    const mode = (r.source_mode ?? "").trim().toLowerCase() as ChallengeSourceMode;
    if (!VALID_MODES.includes(mode)) continue;

    challenges.push({
      seasonNumber: r.season_number,
      challengeNumber: r.challenge_number,
      name: (r.challenge_name ?? "").trim(),
      description: (r.description ?? "").trim(),
      prize: (r.prize ?? "").trim(),
      priority: r.priority ?? 999,
      sourceMode: mode,
      metric: (r.metric ?? "").trim(),
      tiebreak1: (r.tiebreak_1 ?? "").trim(),
      tiebreak2: (r.tiebreak_2 ?? "").trim(),
      topN: Math.max(1, r.top_n ?? 5),
      prizeCutoff: Math.max(0, r.prize_cutoff ?? 2),
      threshold: r.threshold ?? 0,
    });
  }
  return challenges.sort((a, b) => a.priority - b.priority);
}

/* ---------- standings ---------- */

type StandingRow = {
  challenge_number: number | null;
  account_id: string | null;
  nickname: string | null;
  rank: number | null;
  metric_value: number | null;
  match_code: string | null;
  is_prize_winning: boolean | null;
  /** gun_threshold_count: the qualifying gun names, best gun first. */
  metric_detail: string[] | null;
};

type LifetimeLite = {
  account_id: string;
  profile_pic_url: string | null;
  current_level: number | null;
};

/**
 * Build ChallengeWithEntries[] for a season from the precomputed
 * standings, enriched with each player's level + rank badge. Challenges
 * with no standings rows (e.g. a not-yet-played season, or a source mode
 * the SQL engine doesn't compute) come back with an empty entries list –
 * the view renders its own empty state, exactly as before.
 */
export async function getSeasonChallengeData(
  supabase: SupabaseClient,
  season: Season,
  challenges: Challenge[],
): Promise<ChallengeWithEntries[]> {
  const [standingsRes, lifetimeRes, ranksRes] = await Promise.all([
    supabase
      .from("season_challenge_standings")
      .select("challenge_number, account_id, nickname, rank, metric_value, match_code, is_prize_winning, metric_detail")
      .eq("season_number", season.number)
      .order("rank"),
    supabase
      .from("player_stats_lifetime")
      .select("account_id, profile_pic_url, current_level"),
    supabase.from("rank_levels").select("level, badge_url"),
  ]);

  const lifeByAccount = new Map<string, LifetimeLite>();
  for (const r of (lifetimeRes.data ?? []) as LifetimeLite[]) {
    if (r.account_id) lifeByAccount.set(r.account_id, r);
  }
  const badgeByLevel = new Map<number, string>();
  for (const r of (ranksRes.data ?? []) as { level: number | null; badge_url: string | null }[]) {
    if (r.level !== null && r.badge_url) badgeByLevel.set(r.level, r.badge_url);
  }

  // Group standings by challenge_number.
  const byChallenge = new Map<number, StandingRow[]>();
  for (const s of (standingsRes.data ?? []) as StandingRow[]) {
    if (s.challenge_number === null) continue;
    const arr = byChallenge.get(s.challenge_number);
    if (arr) arr.push(s);
    else byChallenge.set(s.challenge_number, [s]);
  }

  return challenges.map((challenge): ChallengeWithEntries => {
    // Drop unclaimed "Head NN" headset scores (they're real accounts, so the
    // SQL engine keeps them, but they never appear on leaderboards), then
    // re-rank sequentially so display ranks stay contiguous and prize-winning
    // is the first prizeCutoff surviving rows.
    const rows = (byChallenge.get(challenge.challengeNumber) ?? [])
      .filter((s) => !isUnclaimedNickname((s.nickname ?? "").trim()))
      .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999))
      .slice(0, challenge.topN);

    const entries: ChallengeEntry[] = rows.map((s, idx): ChallengeEntry => {
      const life = s.account_id ? lifeByAccount.get(s.account_id) : undefined;
      const level = life?.current_level ?? 0;
      const rank = idx + 1;
      return {
        rank,
        nickname: (s.nickname ?? "").trim(),
        profilePicUrl: (life?.profile_pic_url ?? "").trim() || FALLBACK_PROFILE_PIC,
        rankBadgeUrl: badgeByLevel.get(level) ?? "",
        level,
        metricValue: s.metric_value ?? 0,
        qualifyingGuns: s.metric_detail ?? undefined,
        matchId: s.match_code ?? undefined,
        isPrizeWinning: rank <= challenge.prizeCutoff,
      };
    });

    return { challenge, entries };
  });
}
