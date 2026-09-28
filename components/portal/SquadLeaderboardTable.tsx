"use client";

/**
 * components/portal/SquadLeaderboardTable.tsx
 * --------------------------------------------------------------------
 * Sortable leaderboard of a squad's members: profile thumbnail + rank badge and
 * per-round summary stats (round win %, kills/round, K/D, acc%, dmg/round,
 * score/round, ELO, XP). Reuses LeaderboardTable; each row links to that
 * player's summary. Members with no games show "–".
 */
import { useMemo } from "react";
import { cldImage } from "@/lib/cld";
import { LeaderboardTable, type LeaderboardColumn } from "@/components/portal/tables/LeaderboardTable";

export type SquadLeaderRow = {
  account_id: string;
  ops_tag: string | null;
  profile_pic_url: string | null;
  level: number | null;
  rank_badge_url: string | null;
  games: number | null;
  round_win_rate: number | null;
  kills_per_round: number | null;
  kd: number | null;
  accuracy: number | null;
  damage_per_round: number | null;
  score_per_round: number | null;
  elo: number | null;
  xp: number | null;
};

const num = (n: number | null) => n ?? 0;
const fix1 = (n: number | null) => (n != null ? Number(n).toFixed(1) : "–");
const fix2 = (n: number | null) => (n != null ? Number(n).toFixed(2) : "–");
const pct = (n: number | null) => (n != null ? `${Math.round(Number(n) * 100)}%` : "–");
const intOrDash = (n: number | null): string | number => (n == null ? "–" : Math.round(Number(n)));

function squareUrl(url: string, w = 64): string {
  return url.includes("/upload/") ? url.replace("/upload/", `/upload/c_fill,ar_1:1,g_auto,w_${w},q_auto,f_auto/`) : url;
}

export function SquadLeaderboardTable({ rows }: { rows: SquadLeaderRow[] }) {
  const columns = useMemo<LeaderboardColumn<SquadLeaderRow>[]>(
    () => [
      {
        key: "player",
        header: "Player",
        align: "left",
        sortable: true,
        sortType: "string",
        accessor: (r) => r.ops_tag ?? "",
        width: "minmax(120px, 1.4fr)",
        widthSm: "minmax(150px, 1.4fr)",
        cell: (r) => (
          <span className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden portal-card text-[0.55rem] font-bold text-text-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {r.profile_pic_url ? <img src={cldImage(squareUrl(r.profile_pic_url, 48), { w: 384 })} alt="" className="h-full w-full object-cover" /> : (r.ops_tag || "P").slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate text-xs font-bold text-accent sm:text-sm">{r.ops_tag ?? "Player"}</span>
          </span>
        ),
      },
      {
        key: "level",
        header: "Level",
        align: "left",
        sortable: true,
        numeric: true,
        sortType: "number",
        accessor: (r) => num(r.level),
        width: "58px",
        widthSm: "66px",
        cell: (r) => (
          <span className="flex items-center gap-1.5">
            {r.rank_badge_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cldImage(r.rank_badge_url, { w: 384 })} alt="" className="h-6 w-auto shrink-0" />
            )}
            <span className="tabular-nums">{r.level ?? "–"}</span>
          </span>
        ),
      },
      { key: "games", header: "Games", align: "right", sortable: true, numeric: true, sortType: "number", accessor: (r) => num(r.games), width: "52px", widthSm: "62px", cell: (r) => (r.games ?? "–") },
      { key: "win", header: "Win%", align: "right", sortable: true, numeric: true, sortType: "number", accessor: (r) => num(r.round_win_rate), width: "50px", widthSm: "60px", cell: (r) => pct(r.round_win_rate) },
      { key: "kpr", header: "Kills/R", align: "right", sortable: true, numeric: true, sortType: "number", accessor: (r) => num(r.kills_per_round), width: "56px", widthSm: "66px", cell: (r) => fix1(r.kills_per_round) },
      { key: "kd", header: "K/D", align: "right", sortable: true, numeric: true, sortType: "number", accessor: (r) => num(r.kd), width: "44px", widthSm: "52px", cell: (r) => fix2(r.kd) },
      { key: "acc", header: "Acc%", align: "right", sortable: true, numeric: true, sortType: "number", accessor: (r) => num(r.accuracy), width: "48px", widthSm: "56px", cell: (r) => pct(r.accuracy) },
      { key: "dpr", header: "Dmg/R", align: "right", sortable: true, numeric: true, sortType: "number", accessor: (r) => num(r.damage_per_round), width: "58px", widthSm: "70px", cell: (r) => (r.damage_per_round != null ? Math.round(Number(r.damage_per_round)).toLocaleString("en-US") : "–") },
      { key: "spr", header: "Score/R", align: "right", sortable: true, numeric: true, sortType: "number", accessor: (r) => num(r.score_per_round), width: "62px", widthSm: "74px", cell: (r) => (r.score_per_round != null ? Math.round(Number(r.score_per_round)).toLocaleString("en-US") : "–") },
      { key: "elo", header: "ELO", align: "right", sortable: true, numeric: true, sortType: "number", accessor: (r) => num(r.elo), width: "48px", widthSm: "58px", cell: (r) => intOrDash(r.elo) },
      { key: "xp", header: "XP", align: "right", sortable: true, numeric: true, sortType: "number", accessor: (r) => num(r.xp), width: "58px", widthSm: "70px", cell: (r) => (r.xp != null ? Number(r.xp).toLocaleString("en-US") : "–") },
    ],
    [],
  );

  return (
    <section aria-label="Squad leaderboard" className="overflow-hidden rounded-sm portal-card">
      <header className="bg-accent px-5 py-3 text-center sm:px-6 sm:py-4">
        <h2 className="text-lg font-extrabold uppercase tracking-tight text-bg sm:text-xl">Squad Leaderboard</h2>
      </header>
      <div className="p-3 sm:p-4">
        <LeaderboardTable
          ariaLabel="Squad leaderboard – members' per-round stats"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.account_id}
          rowHref={(r) => (r.ops_tag ? `/player-portal/player-stats/summary?ops=${encodeURIComponent(r.ops_tag)}` : null)}
          rowLinkAriaLabel={(r) => `View ${r.ops_tag ?? "player"}'s summary`}
        />
      </div>
    </section>
  );
}
