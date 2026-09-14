/**
 * lib/leaderboards/supabase-period.ts
 * --------------------------------------------------------------------
 * Supabase-backed replacement for fetchPeriodRows(). Emits the existing
 * PeriodRow[] shape (one row per player per month) from the
 * leaderboard_period_stats read-model, so the All-Time period tables
 * (Match/Round Wins, Score, Kills, Damage, Accuracy) and their
 * client-side Year/Month filter + aggregation logic render unchanged.
 *
 * We read only the period_type='month' rows: the client filters those by
 * year/month and SUMS them, which reproduces every filter combination
 * (all-time = sum of all months, year = sum of that year's months, etc.)
 * exactly as the Sheets version did. The precomputed all-time / year /
 * season rows in the table are used by other surfaces, not here.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PeriodRow, PeriodStatsRaw } from "@/lib/leaderboards/period-shared";
import { FALLBACK_PROFILE_PIC } from "@/lib/leaderboards/period-shared";
import { isUnclaimedNickname } from "@/lib/leaderboards/unclaimed";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const str = (v: number | null | undefined): string =>
  v === null || v === undefined ? "" : String(v);

type Row = {
  nickname: string | null;
  profile_pic_url: string | null;
  period_key: string | null;
  games: number | null;
  rounds: number | null;
  wins: number | null;
  losses: number | null;
  rounds_won: number | null;
  rounds_lost: number | null;
  total_kills: number | null;
  total_deaths: number | null;
  total_hits: number | null;
  total_shots: number | null;
  total_damage: number | null;
  total_score: number | null;
};

/**
 * Fetch monthly period rows from Supabase, shaped as the sheet-era
 * PeriodRow[]. The `raw` object carries the exact header keys the
 * aggregators (kills/score/damage/accuracy/match-round-wins) read via
 * parseNumericOr, so those pure functions need no changes.
 */
export async function getPeriodRowsFromSupabase(
  supabase: SupabaseClient,
): Promise<PeriodRow[]> {
  const { data } = await supabase
    .from("leaderboard_period_stats")
    .select(
      "nickname, profile_pic_url, period_key, games, rounds, wins, losses, rounds_won, rounds_lost, total_kills, total_deaths, total_hits, total_shots, total_damage, total_score",
    )
    .eq("period_type", "month");

  const rows: PeriodRow[] = [];
  for (const r of (data ?? []) as Row[]) {
    const nickname = (r.nickname ?? "").trim();
    if (nickname === "" || isUnclaimedNickname(nickname)) continue;

    const key = (r.period_key ?? "").trim(); // "YYYY-MM"
    const m = /^(\d{4})-(\d{2})$/.exec(key);
    const year = m ? Number(m[1]) : 0;
    const monthNum = m ? Number(m[2]) : 0;
    const monthName =
      monthNum >= 1 && monthNum <= 12 ? MONTHS[monthNum - 1] : "";

    const profileRaw = (r.profile_pic_url ?? "").trim();

    // Reconstruct the sheet-header raw shape the aggregators consume.
    const raw = {
      LaserOps_Nickname: nickname,
      LaserOps_Profile_Image: profileRaw,
      LaserOps_Game_Year: str(year),
      LaserOps_Game_Month_Num: str(monthNum),
      LaserOps_Game_Month: monthName,
      LaserOps_Game_YearMonth: key,
      Matches_Played: str(r.games),
      Rounds_Played: str(r.rounds),
      Matches_Won: str(r.wins),
      Rounds_Won: str(r.rounds_won),
      Rounds_Lost: str(r.rounds_lost),
      Total_Kills: str(r.total_kills),
      Total_Deaths: str(r.total_deaths),
      Total_Hits: str(r.total_hits),
      Total_Shots: str(r.total_shots),
      Total_Damage: str(r.total_damage),
      Total_Points: str(r.total_score),
    } as PeriodStatsRaw;

    rows.push({
      nickname,
      profilePicUrl: profileRaw !== "" ? profileRaw : FALLBACK_PROFILE_PIC,
      year,
      monthNum,
      monthName,
      yearMonth: key,
      raw,
    });
  }

  return rows;
}
