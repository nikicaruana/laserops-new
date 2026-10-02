"use client";

/**
 * components/portal/rivalries/RivalriesView.tsx
 * --------------------------------------------------------------------
 * The Rivalries tab body: three hero cards - Nemesis (biggest rivalry = most
 * combined kills + deaths, same as the match report), Favourite Prey (you kill
 * them most) and Hunted By (they kill you most) - then the all-time head-to-head
 * table (kills for / against / net). Reuses LeaderboardTable for the same
 * sortable UX as the rest of the portal.
 */
import { useMemo } from "react";
import Link from "next/link";
import { LeaderboardTable, type LeaderboardColumn } from "@/components/portal/tables/LeaderboardTable";
import type { PlayerRivalries, RivalStat } from "@/lib/player-rivalries/engine";

function profileHref(ops: string) {
  return `/player-portal/player-stats/summary?ops=${encodeURIComponent(ops)}`;
}

function Avatar({ url, ops, size = "h-10 w-10" }: { url: string | null; ops: string; size?: string }) {
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border-strong bg-bg/40 text-xs font-bold text-text-muted`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : ops.slice(0, 2).toUpperCase()}
    </span>
  );
}

type HeroKind = "nemesis" | "prey" | "hunter";
const HERO: Record<HeroKind, { label: string; labelCls: string; border: string }> = {
  nemesis: { label: "Nemesis", labelCls: "text-red-400", border: "border-red-500/40" },
  prey: { label: "Favourite Prey", labelCls: "text-accent", border: "border-accent/50" },
  hunter: { label: "Hunted By", labelCls: "text-red-400", border: "border-red-500/40" },
};

function HeroCard({ kind, rival }: { kind: HeroKind; rival: RivalStat }) {
  const h = HERO[kind];
  return (
    <Link
      href={profileHref(rival.opsTag)}
      className={`flex items-center gap-4 rounded-sm portal-card border ${h.border} p-5 transition-colors hover:border-accent`}
    >
      <Avatar url={rival.profilePicUrl} ops={rival.opsTag} size="h-16 w-16" />
      <div className="min-w-0">
        <p className={`text-[0.6rem] font-bold uppercase tracking-[0.16em] ${h.labelCls}`}>{h.label}</p>
        <p className="truncate text-lg font-extrabold text-text">{rival.opsTag}</p>
        <p className="mt-0.5 text-sm text-text-muted">
          {kind === "nemesis" ? (
            <>
              <span className="font-mono font-bold text-green-400">{rival.killsFor}</span> killed ·{" "}
              <span className="font-mono font-bold text-red-400">{rival.killsAgainst}</span> killed by
            </>
          ) : kind === "prey" ? (
            <>
              <span className="font-mono text-xl font-bold text-text">{rival.killsFor}</span> times you&rsquo;ve killed them
            </>
          ) : (
            <>
              <span className="font-mono text-xl font-bold text-text">{rival.killsAgainst}</span> times they&rsquo;ve killed you
            </>
          )}
        </p>
      </div>
    </Link>
  );
}

export function RivalriesView({ ops, data }: { ops: string; data: PlayerRivalries }) {
  const columns = useMemo<LeaderboardColumn<RivalStat>[]>(
    () => [
      {
        key: "opponent",
        header: "Opponent",
        align: "left",
        sortable: true,
        sortType: "string",
        accessor: (row) => row.opsTag,
        width: "minmax(140px, 1.6fr)",
        widthSm: "minmax(150px, 1.6fr)",
        cell: (row) => (
          <span className="flex items-center gap-2.5">
            <Avatar url={row.profilePicUrl} ops={row.opsTag} size="h-8 w-8" />
            <span className="block min-w-0 truncate text-xs font-semibold text-text sm:text-sm">{row.opsTag}</span>
          </span>
        ),
      },
      {
        key: "killsFor",
        header: "Kills For",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.killsFor,
        width: "64px",
        widthSm: "76px",
        cell: (row) => <span className="text-green-400">{row.killsFor}</span>,
      },
      {
        key: "killsAgainst",
        header: "Kills Against",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.killsAgainst,
        width: "64px",
        widthSm: "88px",
        cell: (row) => <span className="text-red-400">{row.killsAgainst}</span>,
      },
      {
        key: "net",
        header: "Net",
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (row) => row.net,
        width: "56px",
        widthSm: "68px",
        cell: (row) => (
          <span className={row.net > 0 ? "text-green-400" : row.net < 0 ? "text-red-400" : "text-text-muted"}>
            {row.net > 0 ? "+" : ""}
            {row.net}
          </span>
        ),
      },
    ],
    [],
  );

  if (data.opponents.length === 0) {
    return (
      <div className="mt-8 rounded-sm portal-card px-6 py-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">No rivalries yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-text-subtle">
          Head-to-head rivalries build up as {ops} plays matches. Once games are processed, your Nemesis, favourite
          prey and who hunts you most appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-6">
      {(data.nemesis || data.favouritePrey || data.huntedBy) && (
        <div className="grid gap-4 sm:grid-cols-3">
          {data.nemesis && <HeroCard kind="nemesis" rival={data.nemesis} />}
          {data.favouritePrey && <HeroCard kind="prey" rival={data.favouritePrey} />}
          {data.huntedBy && <HeroCard kind="hunter" rival={data.huntedBy} />}
        </div>
      )}

      <section className="overflow-hidden rounded-sm portal-card">
        <header className="bg-accent px-5 py-3 text-center sm:px-6 sm:py-4">
          <h2 className="text-lg font-extrabold uppercase tracking-tight text-bg sm:text-xl">Head to head</h2>
        </header>
        <div className="p-3 sm:p-4">
          <LeaderboardTable
            ariaLabel="Head-to-head kills for and against every opponent"
            columns={columns}
            rows={data.opponents}
            rowKey={(row) => row.opsTag}
            rowHref={(row) => profileHref(row.opsTag)}
            rowLinkAriaLabel={(row) => `View ${row.opsTag}'s profile`}
          />
        </div>
      </section>
    </div>
  );
}
