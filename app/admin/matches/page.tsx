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
import { MatchDateFilter } from "@/components/admin/MatchDateFilter";

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

const TABS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "tentative", label: "Tentative" },
  { key: "awaiting_confirm", label: "Awaiting OK" },
  { key: "confirmed", label: "Confirmed" },
  { key: "live", label: "Live" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const TYPE_TABS: { key: string; label: string }[] = [
  { key: "all", label: "All types" },
  { key: "laserops_open", label: "LaserOps Open" },
  { key: "double_xp", label: "Double XP" },
  { key: "community_open", label: "Community Open" },
  { key: "private", label: "Private Bookings" },
];

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
    month: "short",
    year: "numeric",
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
  const active = TABS.find((t) => t.key === status)?.key ?? "all";
  const activeType = TYPE_TABS.find((t) => t.key === type)?.key ?? "all";

  const supabase = await createClient();
  let query = supabase
    .from("matches")
    .select(
      "id, match_code, title, status, scheduled_at, played_on, round_count, source_file_type, scoring_mode, online_round_count, offline_round_count, xp_distributed_at, elo_calculated_at, results_stale_at, registered_count, paid_count, on_day_count, is_private, is_double_xp, created_by, match_player_aggregate(count)",
    )
    .order("scheduled_at", { ascending: false, nullsFirst: false })
    .order("played_on", { ascending: false, nullsFirst: false })
    .limit(500);
  if (active !== "all") query = query.eq("status", active);

  const { data } = await query;
  let rows = (data ?? []) as Row[];
  // Date-range filter on each match's effective date (inclusive).
  if (from) rows = rows.filter((m) => { const d = effectiveDate(m); return d != null && d >= from; });
  if (to) rows = rows.filter((m) => { const d = effectiveDate(m); return d != null && d <= to; });
  // Type filter (LaserOps/Community/Double XP/Private). Needs admin account ids
  // to tell LaserOps-created from player-created open games.
  if (activeType !== "all") {
    const { data: adminRows } = await supabase.from("accounts").select("id").eq("is_admin", true);
    const adminIds = new Set(((adminRows ?? []) as { id: string }[]).map((a) => a.id));
    rows = rows.filter((m) => categoryOf(m, adminIds) === activeType);
  }

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

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((t) => {
            const params = new URLSearchParams();
            if (t.key !== "all") params.set("status", t.key);
            if (activeType !== "all") params.set("type", activeType);
            if (from) params.set("from", from);
            if (to) params.set("to", to);
            const qs = params.toString();
            return (
              <Link
                key={t.key}
                href={qs ? `/admin/matches?${qs}` : "/admin/matches"}
                className={`border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] ${
                  t.key === active
                    ? "border-accent bg-bg-elevated text-accent"
                    : "border-border-strong text-text-muted hover:border-accent hover:text-accent"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
        <MatchDateFilter />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {TYPE_TABS.map((t) => {
          const params = new URLSearchParams();
          if (active !== "all") params.set("status", active);
          if (t.key !== "all") params.set("type", t.key);
          if (from) params.set("from", from);
          if (to) params.set("to", to);
          const qs = params.toString();
          return (
            <Link
              key={t.key}
              href={qs ? `/admin/matches?${qs}` : "/admin/matches"}
              className={`border px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.1em] ${
                t.key === activeType
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border-strong text-text-muted hover:border-accent hover:text-accent"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">
          No matches{active === "all" ? "" : ` with status "${active}"`}
          {from || to ? " in that date range" : ""}.
        </p>
      ) : (
        <div className="overflow-x-auto border border-border">
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
                <th className="px-3 py-2.5 text-right font-semibold" />
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
                    <td className="max-w-[15rem] truncate px-3 py-2.5 text-text-muted" title={m.title ?? m.match_code ?? ""}>
                      {m.title ?? m.match_code ?? EMPTY}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-text-muted">{fmtDateTime(m.scheduled_at, m.played_on)}</td>
                    <td className="px-3 py-2.5"><MatchStatusBadge status={m.status} /></td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="font-mono tabular-nums text-text">{reg}</span>
                      {!played && (
                        <span className="ml-1 text-[0.65rem] text-text-subtle">
                          ({m.paid_count ?? 0} paid, {m.on_day_count ?? 0} on day)
                        </span>
                      )}
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
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <Link
                        href={`/admin/matches/${m.id}`}
                        className="text-xs font-bold uppercase tracking-[0.12em] text-accent hover:text-accent-soft"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
