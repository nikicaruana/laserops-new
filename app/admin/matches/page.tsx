/**
 * app/admin/matches/page.tsx
 * --------------------------------------------------------------------
 * Admin Match Manager — every game, past and upcoming, with its lifecycle
 * status and processing state. Columns: code, date/time, status, player count,
 * file type, rounds, XP-distributed + ELO-calculated. Status filter tabs.
 * Read view for now; per-match management (entries, ingestion) is the detail
 * page + later phases.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MatchStatusBadge } from "@/components/admin/MatchStatusBadge";

export const metadata = { title: "Match Manager" };

type Row = {
  id: string;
  match_code: string | null;
  status: string | null;
  scheduled_at: string | null;
  played_on: string | null;
  round_count: number | null;
  source_file_type: string | null;
  xp_distributed_at: string | null;
  elo_calculated_at: string | null;
  match_player_aggregate: { count: number }[] | null;
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

function fmtDateTime(iso: string | null, dateOnly: string | null): string {
  const src = iso ?? (dateOnly ? `${dateOnly}T00:00:00Z` : null);
  if (!src) return "—";
  const d = new Date(src);
  if (Number.isNaN(d.getTime())) return "—";
  const hasTime = Boolean(iso);
  return d.toLocaleString("en-GB", {
    timeZone: "Europe/Malta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(hasTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function Done({ at, doneLabel, pendingLabel }: { at: string | null; doneLabel: string; pendingLabel: string }) {
  return at ? (
    <span className="inline-flex items-center gap-1 text-xs text-accent">
      <span aria-hidden>✓</span> {doneLabel}
    </span>
  ) : (
    <span className="text-xs text-text-subtle">{pendingLabel}</span>
  );
}

export default async function AdminMatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = TABS.find((t) => t.key === status)?.key ?? "all";

  const supabase = await createClient();
  let query = supabase
    .from("matches")
    .select(
      "id, match_code, status, scheduled_at, played_on, round_count, source_file_type, xp_distributed_at, elo_calculated_at, match_player_aggregate(count)",
    )
    .order("scheduled_at", { ascending: false, nullsFirst: false })
    .order("played_on", { ascending: false, nullsFirst: false })
    .limit(500);
  if (active !== "all") query = query.eq("status", active);

  const { data } = await query;
  const rows = (data ?? []) as Row[];

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
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/admin/matches" : `/admin/matches?status=${t.key}`}
            className={`border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] ${
              t.key === active
                ? "border-accent bg-bg-elevated text-accent"
                : "border-border-strong text-text-muted hover:border-accent hover:text-accent"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">
          No matches{active === "all" ? " yet" : ` with status "${active}"`}.
        </p>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-elevated text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
                <th className="px-4 py-3 font-semibold">Match</th>
                <th className="px-4 py-3 font-semibold">Date / time</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Players</th>
                <th className="px-4 py-3 text-center font-semibold">File</th>
                <th className="px-4 py-3 text-right font-semibold">Rounds</th>
                <th className="px-4 py-3 font-semibold">XP</th>
                <th className="px-4 py-3 font-semibold">ELO</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const players = m.match_player_aggregate?.[0]?.count ?? 0;
                return (
                  <tr key={m.id} className="border-b border-border last:border-0 hover:bg-bg-elevated/50">
                    <td className="px-4 py-3 font-mono font-semibold text-text">{m.match_code ?? "—"}</td>
                    <td className="px-4 py-3 text-text-muted">{fmtDateTime(m.scheduled_at, m.played_on)}</td>
                    <td className="px-4 py-3"><MatchStatusBadge status={m.status} /></td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-text">{players}</td>
                    <td className="px-4 py-3 text-center text-xs uppercase text-text-muted">
                      {m.source_file_type ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-text-muted">
                      {m.round_count ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Done at={m.xp_distributed_at} doneLabel="Distributed" pendingLabel="Pending" />
                    </td>
                    <td className="px-4 py-3">
                      <Done at={m.elo_calculated_at} doneLabel="Calculated" pendingLabel="Pending" />
                    </td>
                    <td className="px-4 py-3 text-right">
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
