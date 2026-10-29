/**
 * app/admin/matches/page.tsx
 * --------------------------------------------------------------------
 * Admin Match Manager – every game, past and upcoming, with its lifecycle
 * status and processing state. Status tabs + a date-range filter. Tightened to
 * fit one screen (players and processing are merged columns). Read view; per
 * match management (entries, ingestion, invite link) lives on the detail page.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MatchStatusBadge } from "@/components/admin/MatchStatusBadge";
import { MatchFilters } from "@/components/admin/MatchFilters";
import {
  STATUS_KEYS,
  TYPE_KEYS,
  DEFAULT_STATUS,
  DEFAULT_TYPE,
  parseSelection,
} from "@/lib/admin/match-filters";

export const metadata = { title: "Match Manager" };

const EMPTY = <span className="text-text-subtle">–</span>;

type Row = {
  id: string;
  match_code: string | null;
  title: string | null;
  status: string | null;
  scheduled_at: string | null;
  played_on: string | null;
  round_count: number | null;
  source_file_type: string | null;
  scoring_mode: string | null;
  online_round_count: number | null;
  offline_round_count: number | null;
  xp_distributed_at: string | null;
  elo_calculated_at: string | null;
  results_stale_at: string | null;
  registered_count: number | null;
  paid_count: number | null;
  on_day_count: number | null;
  match_player_aggregate: { count: number }[] | null;
  is_private: boolean | null;
  is_double_xp: boolean | null;
  created_by: string | null;
};

/** Classify a match into one of the type tabs. LaserOps vs Community is by
 *  whether the creator is an admin account (else it is player-created). */
function categoryOf(m: Row, adminIds: Set<string>): string {
  if (m.is_private) return "private";
  if (m.is_double_xp) return "double_xp";
  if (m.created_by && !adminIds.has(m.created_by)) return "community_open";
  return "laserops_open";
}

/** The date a match happens on, as YYYY-MM-DD (scheduled first, else played). */
function effectiveDate(m: Row): string | null {
  if (m.scheduled_at) return m.scheduled_at.slice(0, 10);
  if (m.played_on) return m.played_on.slice(0, 10);
  return null;
}

function fmtDateTime(iso: string | null, dateOnly: string | null): React.ReactNode {
  const src = iso ?? (dateOnly ? `${dateOnly}T00:00:00Z` : null);
  if (!src) return EMPTY;
  const d = new Date(src);
  if (Number.isNaN(d.getTime())) return EMPTY;
  return d.toLocaleString("en-GB", {
    timeZone: "Europe/Malta",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    ...(iso ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

// MODE column. Reads the per-mode round split (online_round_count /
// offline_round_count, stamped at publish); a game with both > 0 is a hybrid
// and shows BOTH badges with their round counts. Falls back to scoring_mode
// for any legacy row missing the counts.
function ModeBadges({ online, offline, mode }: { online: number | null; offline: number | null; mode: string | null }) {
  const pill = "inline-block rounded px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.1em]";
  const sky = "bg-sky-500/15 text-sky-300";
  const amber = "bg-amber-500/15 text-amber-300";
  if (online == null && offline == null) {
    return <span className={`${pill} ${mode === "offline" ? amber : sky}`}>{mode === "offline" ? "Offline" : "Online"}</span>;
  }
  const on = online ?? 0;
  const off = offline ?? 0;
  if (on === 0 && off === 0) {
    return <span className={`${pill} ${mode === "offline" ? amber : sky}`}>{mode === "offline" ? "Offline" : "Online"}</span>;
  }
  const hybrid = on > 0 && off > 0;
  return (
    <span className="inline-flex flex-wrap items-center justify-center gap-1">
      {on > 0 && <span className={`${pill} ${sky}`}>{hybrid ? `Online ${on}` : "Online"}</span>}
      {off > 0 && <span className={`${pill} ${amber}`}>{hybrid ? `Offline ${off}` : "Offline"}</span>}
    </span>
  );
}

export default async function AdminMatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; from?: string; to?: string; type?: string }>;
}) {
  const { status, from, to, type } = await searchParams;
  // Multi-select filters. Absent param -> default selection; "none" -> empty.
  const selStatus = parseSelection(status, STATUS_KEYS, DEFAULT_STATUS);
  const selType = parseSelection(type, TYPE_KEYS, DEFAULT_TYPE);

  const supabase = await createClient();
  let rows: Row[] = [];
  // Status filter: no statuses selected -> no results; every status selected ->
  // no filter (show all, including any legacy/null status); a subset -> filter.
  if (selStatus.length > 0) {
    let query = supabase
      .from("matches")
      .select(
        "id, match_code, title, status, scheduled_at, played_on, round_count, source_file_type, scoring_mode, online_round_count, offline_round_count, xp_distributed_at, elo_calculated_at, results_stale_at, registered_count, paid_count, on_day_count, is_private, is_double_xp, created_by, match_player_aggregate(count)",
      )
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .order("played_on", { ascending: false, nullsFirst: false })
      .limit(500);
    if (selStatus.length < STATUS_KEYS.length) query = query.in("status", selStatus);
    const { data } = await query;
    rows = (data ?? []) as Row[];
  }
  // Date-range filter on each match's effective date (inclusive).
  if (from) rows = rows.filter((m) => { const d = effectiveDate(m); return d != null && d >= from; });
  if (to) rows = rows.filter((m) => { const d = effectiveDate(m); return d != null && d <= to; });
  // Type filter (LaserOps/Community/Double XP/Private): no types selected -> no
  // results; every type selected -> no filter; a subset -> classify + keep.
  // Needs admin account ids to tell LaserOps-created from player-created games.
  if (selType.length === 0) {
    rows = [];
  } else if (selType.length < TYPE_KEYS.length) {
    const { data: adminRows } = await supabase.from("accounts").select("id").eq("is_admin", true);
    const adminIds = new Set(((adminRows ?? []) as { id: string }[]).map((a) => a.id));
    rows = rows.filter((m) => selType.includes(categoryOf(m, adminIds)));
  }

  // Always newest-first by when the game actually happens: effective date is
  // scheduled_at (booked/upcoming) else played_on. Ingested games carry only a
  // played_on, so a scheduled_at-first sort buried them below finance-backfill
  // shells (which do have a scheduled_at); a single effective-date timeline fixes
  // that. Undated rows sort last.
  const whenMs = (m: Row): number => {
    const src = m.scheduled_at ?? (m.played_on ? `${m.played_on}T00:00:00Z` : null);
    const t = src ? new Date(src).getTime() : NaN;
    return Number.isNaN(t) ? -Infinity : t;
  };
  rows.sort((a, b) => whenMs(b) - whenMs(a));

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
            Match Manager
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Every game and its processing state. Click a match to manage entries and ingest data.
          </p>
        </div>
        <Link
          href="/admin/matches/new"
          className="flex h-11 items-center gap-2 border border-accent bg-accent px-5 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98]"
        >
          + Create match
        </Link>
      </header>

      <MatchFilters selStatus={selStatus} selType={selType} />

      {rows.length === 0 ? (
        <p className="border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">
          No matches match the selected filters{from || to ? " in that date range" : ""}.
        </p>
      ) : (
        <>
          {/* Mobile: stacked cards (the wide table is unreadable on a phone) */}
          <div className="space-y-2 sm:hidden">
            {rows.map((m) => {
              const played = m.status === "completed";
              const entriesCount = m.match_player_aggregate?.[0]?.count ?? 0;
              const reg = played ? entriesCount : m.registered_count ?? 0;
              return (
                <Link
                  key={m.id}
                  href={`/admin/matches/${m.id}`}
                  className="block border border-border bg-bg-elevated/30 px-4 py-3 active:bg-bg-elevated"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-text">
                      {m.title ?? m.match_code ?? "Match"}
                    </p>
                    <MatchStatusBadge status={m.status} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.7rem] text-text-muted">
                    <span className="font-mono text-text-subtle">{m.match_code ?? "No ID"}</span>
                    <span aria-hidden className="text-text-subtle">·</span>
                    <span>{fmtDateTime(m.scheduled_at, m.played_on)}</span>
                    <span aria-hidden className="text-text-subtle">·</span>
                    <span className="font-mono tabular-nums">{reg} {played ? "played" : "signed up"}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <ModeBadges online={m.online_round_count} offline={m.offline_round_count} mode={m.scoring_mode} />
                    <span className={`inline-block rounded px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.1em] ${m.xp_distributed_at ? "bg-accent/15 text-accent" : "bg-bg text-text-subtle"}`}>
                      {m.xp_distributed_at ? "✓ XP" : "XP pending"}
                    </span>
                    <span className={`inline-block rounded px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.1em] ${m.results_stale_at ? "bg-amber-500/15 text-amber-300" : m.elo_calculated_at ? "bg-accent/15 text-accent" : "bg-bg text-text-subtle"}`}>
                      {m.results_stale_at ? "⟳ ELO stale" : m.elo_calculated_at ? "✓ ELO" : "ELO pending"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Desktop / tablet: full table */}
          <div className="hidden overflow-x-auto border border-border sm:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-elevated text-[0.58rem] uppercase tracking-[0.12em] text-text-muted">
                <th className="px-3 py-2.5 font-semibold">Match ID</th>
                <th className="px-3 py-2.5 font-semibold">Title</th>
                <th className="px-3 py-2.5 font-semibold">Date / time</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 text-right font-semibold">Players</th>
                <th className="px-3 py-2.5 text-center font-semibold">Mode</th>
                <th className="px-3 py-2.5 text-center font-semibold">File</th>
                <th className="px-3 py-2.5 text-right font-semibold">Rds</th>
                <th className="px-3 py-2.5 font-semibold">Processed</th>
                <th className="sticky right-0 z-20 w-px border-l border-border bg-bg-elevated px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const played = m.status === "completed";
                const entriesCount = m.match_player_aggregate?.[0]?.count ?? 0;
                const reg = played ? entriesCount : m.registered_count ?? 0;
                return (
                  <tr key={m.id} className="border-b border-border last:border-0 align-middle hover:bg-bg-elevated/50">
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono font-semibold text-text">{m.match_code ?? EMPTY}</td>
                    <td className="w-full max-w-0 truncate px-3 py-2.5 text-text-muted" title={m.title ?? m.match_code ?? ""}>
                      {m.title ?? m.match_code ?? EMPTY}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-text-muted">{fmtDateTime(m.scheduled_at, m.played_on)}</td>
                    <td className="px-3 py-2.5"><MatchStatusBadge status={m.status} /></td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <span className="font-mono tabular-nums text-text">{reg}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <ModeBadges online={m.online_round_count} offline={m.offline_round_count} mode={m.scoring_mode} />
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs uppercase text-text-muted">{m.source_file_type ?? EMPTY}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-text-muted">{m.round_count ?? EMPTY}</td>
                    <td className="px-3 py-2.5 text-[0.65rem] leading-tight">
                      <span className={`block ${m.xp_distributed_at ? "text-accent" : "text-text-subtle"}`}>
                        {m.xp_distributed_at ? "✓ XP" : "XP pending"}
                      </span>
                      <span className={`block ${m.results_stale_at ? "text-amber-300" : m.elo_calculated_at ? "text-accent" : "text-text-subtle"}`}>
                        {m.results_stale_at ? "⟳ ELO stale" : m.elo_calculated_at ? "✓ ELO" : "ELO pending"}
                      </span>
                      {m.results_stale_at && (
                        <span className="mt-0.5 inline-block bg-amber-500/15 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.1em] text-amber-300">
                          Recompute
                        </span>
                      )}
                    </td>
                    <td className="sticky right-0 z-10 w-px border-l border-border bg-bg-elevated px-3 py-2.5 text-center">
                      <Link
                        href={`/admin/matches/${m.id}`}
                        aria-label={`Manage ${m.match_code ?? m.title ?? "match"}`}
                        title="Manage match"
                        className="inline-flex h-7 w-7 items-center justify-center border border-border-strong text-accent transition-colors hover:border-accent hover:bg-accent hover:text-bg"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                          <path d="M5 12h14" />
                          <path d="M13 6l6 6-6 6" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  );
}
