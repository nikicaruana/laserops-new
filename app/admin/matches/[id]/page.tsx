/**
 * app/admin/matches/[id]/page.tsx
 * --------------------------------------------------------------------
 * Match detail — the match's lifecycle/processing summary plus its player
 * entries (match_player_aggregate). Read view for Phase 1; adding / editing /
 * merging entries and JSON/CSV ingestion land in later phases.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MatchStatusBadge } from "@/components/admin/MatchStatusBadge";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("matches").select("match_code").eq("id", id).maybeSingle();
  return { title: data?.match_code ? `${data.match_code} · Matches` : "Match" };
}

type Entry = {
  id: string;
  nickname: string | null;
  headset_label: string | null;
  team_colour: string | null;
  gun_used: string | null;
  account_id: string | null;
  score: number | null;
  frags: number | null;
  deaths: number | null;
  kd: number | null;
  accuracy: number | null;
  was_winner: boolean | null;
  xp_total: number | null;
  elo_after: number | null;
};

function fmtDateTime(iso: string | null, dateOnly: string | null): string {
  const src = iso ?? (dateOnly ? `${dateOnly}T00:00:00Z` : null);
  if (!src) return "—";
  const d = new Date(src);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    timeZone: "Europe/Malta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(iso ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-bg-elevated px-4 py-3">
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-text-muted">{label}</p>
      <div className="mt-1 text-sm text-text">{children}</div>
    </div>
  );
}

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: match }, { data: entryRows }] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "id, match_code, status, scheduled_at, played_on, round_count, source_file_type, xp_distributed_at, elo_calculated_at, winning_team_colour, is_private, is_double_xp",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("match_player_aggregate")
      .select(
        "id, nickname, headset_label, team_colour, gun_used, account_id, score, frags, deaths, kd, accuracy, was_winner, xp_total, elo_after",
      )
      .eq("match_id", id)
      .order("score", { ascending: false, nullsFirst: false }),
  ]);

  if (!match) notFound();
  const entries = (entryRows ?? []) as Entry[];

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 text-xs">
        <Link href="/admin/matches" className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
          ← Match Manager
        </Link>
      </div>

      <header className="mb-6 flex flex-wrap items-center gap-4 border-b border-border pb-6">
        <h1 className="font-mono text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
          {match.match_code ?? "Match"}
        </h1>
        <MatchStatusBadge status={match.status} />
        {match.is_double_xp && (
          <span className="border border-amber-700 bg-amber-950/40 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-amber-300">
            Double XP
          </span>
        )}
        {match.is_private && (
          <span className="border border-border-strong px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-text-muted">
            Private
          </span>
        )}
      </header>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Date / time">{fmtDateTime(match.scheduled_at, match.played_on)}</Fact>
        <Fact label="Players">{entries.length}</Fact>
        <Fact label="Rounds">{match.round_count ?? "—"}</Fact>
        <Fact label="Source file">{match.source_file_type ? match.source_file_type.toUpperCase() : "—"}</Fact>
        <Fact label="XP">
          {match.xp_distributed_at ? (
            <span className="text-accent">Distributed</span>
          ) : (
            <span className="text-text-subtle">Pending</span>
          )}
        </Fact>
        <Fact label="ELO">
          {match.elo_calculated_at ? (
            <span className="text-accent">Calculated</span>
          ) : (
            <span className="text-text-subtle">Pending</span>
          )}
        </Fact>
        <Fact label="Winning team">{match.winning_team_colour ?? "—"}</Fact>
      </div>

      <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.12em] text-accent">
        Player entries ({entries.length})
      </h2>

      {entries.length === 0 ? (
        <p className="border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">
          No entries yet. Players joining a live match or a JSON/CSV import will populate this.
        </p>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-elevated text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
                <th className="px-4 py-3 font-semibold">Player</th>
                <th className="px-4 py-3 font-semibold">Headband</th>
                <th className="px-4 py-3 font-semibold">Team</th>
                <th className="px-4 py-3 font-semibold">Gun</th>
                <th className="px-4 py-3 text-right font-semibold">Score</th>
                <th className="px-4 py-3 text-right font-semibold">K</th>
                <th className="px-4 py-3 text-right font-semibold">D</th>
                <th className="px-4 py-3 text-right font-semibold">K/D</th>
                <th className="px-4 py-3 text-right font-semibold">Acc</th>
                <th className="px-4 py-3 text-right font-semibold">XP</th>
                <th className="px-4 py-3 text-center font-semibold">Linked</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-bg-elevated/50">
                  <td className="px-4 py-3">
                    <span className="font-semibold text-text">{e.nickname ?? "—"}</span>
                    {e.was_winner && <span className="ml-2 text-[0.6rem] font-bold uppercase text-accent">Win</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-text-muted">{e.headset_label ?? "—"}</td>
                  <td className="px-4 py-3 text-text-muted">{e.team_colour ?? "—"}</td>
                  <td className="px-4 py-3 text-text-muted">{e.gun_used ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-text">{e.score ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-text-muted">{e.frags ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-text-muted">{e.deaths ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-text-muted">
                    {e.kd === null || e.kd === undefined ? "—" : e.kd.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-text-muted">
                    {e.accuracy === null || e.accuracy === undefined ? "—" : `${Math.round(e.accuracy * 100)}%`}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-text-muted">{e.xp_total ?? "—"}</td>
                  <td className="px-4 py-3 text-center">
                    {e.account_id ? (
                      <span className="text-accent" title="Linked to an account">●</span>
                    ) : (
                      <span className="text-text-subtle/50" title="Unresolved (no linked account)">○</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-[0.65rem] text-text-subtle">
        Adding, editing, and merging entries (headband switches) and JSON/CSV ingestion arrive in the
        next phases of the Match Manager.
      </p>
    </div>
  );
}
