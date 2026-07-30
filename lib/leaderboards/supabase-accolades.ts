/**
 * lib/leaderboards/supabase-accolades.ts
 * --------------------------------------------------------------------
 * Supabase-backed source for the All-Time Accolades leaderboard. Emits
 * synthetic GameDataRow[] (one row per player-match that earned >= 1
 * accolade) from match_awards, with the raw `Accolade_<suffix>` flag
 * columns set, so the existing AccoladesLeaderboardTable + aggregateAccolades
 * (client-side period filter + tier counting) render unchanged.
 *
 * match_awards is one row per (match, player, accolade). We group by
 * (match, player) and flip on the matching Accolade_<suffix> column. The
 * suffix set is the same one the match-report engine + Sheets aggregator
 * use; a match is done by accoladeKey() (case/separator-insensitive).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameDataRow, GameDataRaw } from "@/lib/game-data/lookup";
import { ACCOLADE_COLUMN_SUFFIXES } from "@/lib/match-report/engine";
import { accoladeKey } from "@/lib/cms/accolades";
import { isUnclaimedNickname } from "@/lib/leaderboards/unclaimed";
import { FALLBACK_PROFILE_PIC } from "@/lib/leaderboards/period-shared";

// accoladeKey(name) -> the exact Accolade_<suffix> column the aggregator reads.
const SUFFIX_BY_KEY = new Map<string, string>(
  ACCOLADE_COLUMN_SUFFIXES.map((s) => [accoladeKey(s), s]),
);

type AwardRow = {
  account_id: string | null;
  nickname: string | null;
  match_id: string | null;
  accolade_definition_id: string | null;
};

export async function getAccoladeGameRows(
  supabase: SupabaseClient,
): Promise<GameDataRow[]> {
  const [awardsRes, defsRes, matchRes, lifeRes] = await Promise.all([
    supabase
      .from("match_awards")
      .select("account_id, nickname, match_id, accolade_definition_id"),
    supabase.from("accolade_definitions").select("id, name"),
    supabase.from("matches").select("id, match_code, played_on"),
    supabase.from("player_stats_lifetime").select("account_id, profile_pic_url"),
  ]);

  // accolade_definition_id -> Accolade_<suffix> column name.
  const columnByDef = new Map<string, string>();
  for (const d of (defsRes.data ?? []) as { id: string; name: string | null }[]) {
    const suffix = SUFFIX_BY_KEY.get(accoladeKey(d.name ?? ""));
    if (suffix) columnByDef.set(d.id, `Accolade_${suffix}`);
  }

  const matchById = new Map<string, { code: string; yearMonth: string }>();
  for (const m of (matchRes.data ?? []) as {
    id: string;
    match_code: string | null;
    played_on: string | null;
  }[]) {
    matchById.set(m.id, {
      code: m.match_code ?? "",
      yearMonth: (m.played_on ?? "").slice(0, 7), // "YYYY-MM"
    });
  }

  const picByAccount = new Map<string, string>();
  for (const l of (lifeRes.data ?? []) as {
    account_id: string;
    profile_pic_url: string | null;
  }[]) {
    if (l.profile_pic_url) picByAccount.set(l.account_id, l.profile_pic_url);
  }

  // Group awards into one synthetic row per (match, player).
  type Bucket = {
    nickname: string;
    accountId: string | null;
    matchId: string;
    yearMonth: string;
    columns: Set<string>;
  };
  const buckets = new Map<string, Bucket>();

  for (const a of (awardsRes.data ?? []) as AwardRow[]) {
    const nickname = (a.nickname ?? "").trim();
    if (nickname === "" || isUnclaimedNickname(nickname)) continue; // drop Head NN
    if (!a.match_id) continue;
    const column = a.accolade_definition_id
      ? columnByDef.get(a.accolade_definition_id)
      : undefined;
    if (!column) continue; // unknown/untracked accolade

    const match = matchById.get(a.match_id);
    const key = `${a.match_id}||${(a.account_id ?? nickname).toLowerCase()}`;
    let b = buckets.get(key);
    if (!b) {
      b = {
        nickname,
        accountId: a.account_id,
        matchId: match?.code ?? "",
        yearMonth: match?.yearMonth ?? "",
        columns: new Set<string>(),
      };
      buckets.set(key, b);
    }
    b.columns.add(column);
  }

  const rows: GameDataRow[] = [];
  for (const b of buckets.values()) {
    const raw: Record<string, string> = {
      LaserOps_Nickname: b.nickname,
      LaserOps_Match_ID: b.matchId,
    };
    for (const col of b.columns) raw[col] = "1";
    rows.push({
      nickname: b.nickname,
      profilePicUrl:
        (b.accountId ? picByAccount.get(b.accountId) : undefined) ||
        FALLBACK_PROFILE_PIC,
      rankBadgeUrl: "",
      yearMonth: b.yearMonth,
      matchId: b.matchId,
      raw: raw as GameDataRaw,
    });
  }

  return rows;
}
