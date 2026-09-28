"use client";

/**
 * components/portal/rivalries/RivalriesView.tsx
 * --------------------------------------------------------------------
 * The Rivalries tab body: Nemesis + Favourite Prey hero cards, then the all-time
 * head-to-head table (kills for / against / net, with a rivalry badge per row).
 * Empty until ingestion writes per-opponent kills; renders a graceful empty state
 * until then. Reuses LeaderboardTable for the same sortable UX as the rest of the
 * portal.
 */
import { useMemo } from "react";
import Link from "next/link";
import { LeaderboardTable, type LeaderboardColumn } from "@/components/portal/tables/LeaderboardTable";
import type { PlayerRivalries, RivalStat, RivalBadge } from "@/lib/player-rivalries/engine";

function profileHref(ops: string) {
  return `/player-portal/player-stats/summary?ops=${encodeURIComponent(ops)}`;
}

function Avatar({ url, ops, size = "h-10 w-10" }: { url: string | null; ops: string; size?: string }) {
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-bg-overlay text-xs font-bold text-text-muted`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : ops.slice(0, 2).toUpperCase()}
    </span>
  );
}

const BADGE_STYLES: Record<Exclude<RivalBadge, null>, { label: string; cls: string }> = {
  bully: { label: "Bully", cls: "border-green-500/50 bg-green-500/10 text-green-400" },
  victim: { label: "Victim", cls: "border-red-500/50 bg-red-500/10 text-red-400" },
  even: { label: "Even", cls: "border-border-strong bg-bg text-text-muted" },
};

function Badge({ badge }: { badge: RivalBadge }) {
  if (!badge) return null;
  const s = BADGE_STYLES[badge];
  return <span className={`inline-block border px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.1em] ${s.cls}`}>{s.label}</span>;
}

function HeroCard({ kind, rival }: { kind: "nemesis" | "prey"; rival: RivalStat }) {
  const isNemesis = kind === "nemesis";
  const accent = isNemesis ? "border-red-500/40" : "border-accent/50";
  const label = isNemesis ? "Nemesis" : "Favourite Prey";
  const labelCls = isNemesis ? "text-red-400" : "text-accent";
  const stat = isNemesis ? rival.killsAgainst : rival.killsFor;
  const caption = isNemesis ? "times they've killed you" : "times you've killed them";
  return (
    <Link
      href={profileHref(rival.opsTag)}
      className={`flex items-center gap-4 border ${accent} bg-bg-elevated p-5 transition-colors hover:border-accent`}
    >
      <Avatar url={rival.profilePicUrl} ops={rival.opsTag} size="h-16 w-16" />
      <div className="min-w-0">
        <p className={`text-[0.6rem] font-bold uppercase tracking-[0.16em] ${labelCls}`}>{label}</p>
        <p className="truncate text-lg font-extrabold text-text">{rival.opsTag}</p>
        <p className="mt-0.5 text-sm text-text-muted">
          <span className="font-mono text-xl font-bold text-text">{stat}</span> {caption}
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
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-text sm:text-sm">{row.opsTag}</span>
              {row.badge && <span className="mt-0.5 block"><Badge badge={row.badge} /></span>}
            </span>
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
      <div className="mt-8 border border-dashed border-border bg-bg-elevated px-6 py-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">No rivalries yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-text-subtle">
          Head-to-head rivalries build up as {ops} plays matches. Once games are processed, your Nemesis, your
          favourite prey and a full kills-for / kills-against table appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-6">
      {(data.nemesis || data.favouritePrey) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.favouritePrey && <HeroCard kind="prey" rival={data.favouritePrey} />}
          {data.nemesis && <HeroCard kind="nemesis" rival={data.nemesis} />}
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
