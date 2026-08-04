/**
 * app/admin/matches/[id]/page.tsx
 * --------------------------------------------------------------------
 * Match detail — lifecycle/processing summary, admin lifecycle actions, the
 * signups (for upcoming games) and the player entries (for played games).
 * Entry add/edit/merge and JSON/CSV ingestion arrive in later phases.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MatchStatusBadge } from "@/components/admin/MatchStatusBadge";
import { MatchAdminActions } from "@/components/admin/MatchAdminActions";
import { EditableMatchTitle } from "@/components/admin/EditableMatchTitle";
import { CopyInviteLink } from "@/components/portal/CopyInviteLink";
import { MatchParticipantsManager, type Participant, type ParticipantPayment } from "@/components/admin/MatchParticipantsManager";
import { IngestPanel, type SavedRound } from "@/components/admin/IngestPanel";
import { parseRound } from "@/lib/ingestion/round-parser";
import { parseFormula, defaultFormula } from "@/lib/scoring/formula";
import type { StreakDef, StreakRuleConfig } from "@/lib/ingestion/streak-engine";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("matches").select("match_code, title").eq("id", id).maybeSingle();
  return { title: data?.title || data?.match_code ? `${data?.title ?? data?.match_code} · Matches` : "Match" };
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
};

type Signup = {
  id: string;
  account_id: string | null;
  payment_intent: string | null;
  status: string | null;
  paid_at: string | null;
  created_at: string | null;
  phone: string | null;
  account: { ops_tag: string | null; full_name: string | null } | null;
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

  const [{ data: match }, { data: signupRows }, { data: entryRows }] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "id, match_code, title, status, scheduled_at, played_on, round_count, source_file_type, xp_distributed_at, elo_calculated_at, winning_team_colour, is_private, is_double_xp, min_players, max_players, price_eur, pricing_mode, deposit_eur, registered_count, paid_count, on_day_count, reached_quorum_at, entry_code, invite_code",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("match_signups")
      .select("id, account_id, payment_intent, status, paid_at, created_at, phone, account:accounts(ops_tag, full_name)")
      .eq("match_id", id)
      .order("created_at"),
    supabase
      .from("match_player_aggregate")
      .select(
        "id, nickname, headset_label, team_colour, gun_used, account_id, score, frags, deaths, kd, accuracy, was_winner, xp_total",
      )
      .eq("match_id", id)
      .order("score", { ascending: false, nullsFirst: false }),
  ]);

  if (!match) notFound();

  const [{ data: participantRows }, { data: gunRows }, { data: ingestRows }, { data: formulaRows }, { data: spawnRows }, { data: streakRows }] = await Promise.all([
    supabase
      .from("match_participants")
      .select("id, account_id, headset_label, extra_headbands, gun_used, display_name, source, account:accounts(ops_tag, full_name)")
      .eq("match_id", id)
      .order("joined_at"),
    supabase.from("guns").select("name").order("name"),
    supabase
      .from("match_ingest_rounds")
      .select("id, filename, raw_file")
      .eq("match_id", id)
      .order("created_at"),
    supabase.from("score_formula").select("structure, mode_slug"),
    supabase.from("spawn_camp_config").select("consequence_mode, mode_slug"),
    supabase.from("streak_definitions").select("id, name, streak_key, rule").eq("is_active", true),
  ]);
  // Re-parse the stored raw file with the CURRENT parser on every load, so
  // parser improvements show without re-uploading. Falls back to nothing on a
  // parse error.
  const ingestRounds: SavedRound[] = ((ingestRows ?? []) as { id: string; filename: string | null; raw_file: string | null }[])
    .map((row) => {
      if (!row.raw_file) return null;
      try {
        return { id: row.id, filename: row.filename, parsed: parseRound(row.raw_file) };
      } catch {
        return null;
      }
    })
    .filter((x): x is SavedRound => x !== null);

  // Scoring formula (prefer domination) + spawn-camp consequence for the on-the-fly
  // LaserOps score in the ingest preview.
  const fRows = (formulaRows ?? []) as { structure: unknown; mode_slug: string | null }[];
  const fRow = fRows.find((r) => r.mode_slug === "domination") ?? fRows[0];
  const scoreFormula = fRow ? parseFormula(fRow.structure) : defaultFormula();
  const sRows = (spawnRows ?? []) as { consequence_mode: string | null; mode_slug: string | null }[];
  const sRow = sRows.find((r) => r.mode_slug === "domination") ?? sRows[0];
  const voidSpawn = sRow?.consequence_mode === "void";

  // Streak definitions with a rule -> the engine's config list.
  const streakDefs: StreakDef[] = ((streakRows ?? []) as { id: string; name: string | null; streak_key: string | null; rule: unknown }[])
    .filter((s) => s.rule)
    .map((s) => ({ key: s.streak_key ?? s.id, name: s.name ?? "Streak", rule: s.rule as StreakRuleConfig }));

  const signups = ((signupRows ?? []) as unknown as Signup[]).filter((s) => s.status !== "cancelled");
  const payments: Record<string, ParticipantPayment> = {};
  for (const s of signups) {
    if (s.account_id) payments[s.account_id] = { intent: s.payment_intent, paid: Boolean(s.paid_at) };
  }
  const entries = (entryRows ?? []) as Entry[];
  const participants = (participantRows ?? []) as unknown as Participant[];
  const guns = ((gunRows ?? []) as { name: string }[]).map((g) => g.name).filter(Boolean);
  const isPlayed = match.status === "completed" || entries.length > 0;
  const showRoster = ["confirmed", "live", "completed"].includes(match.status ?? "") || match.is_private || participants.length > 0;

  // headband number -> a label (ops tag / name) so the ingest preview can show
  // who each headband is instead of the raw "Head NN".
  const headbandLabels: Record<number, string> = {};
  for (const p of participants) {
    const label = p.account?.ops_tag || p.account?.full_name || p.display_name;
    if (!label) continue;
    for (const hb of [p.headset_label, ...(p.extra_headbands ?? [])]) {
      const n = hb ? parseInt(hb, 10) : NaN;
      if (!Number.isNaN(n)) headbandLabels[n] = label;
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 text-xs">
        <Link href="/admin/matches" className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
          ← Match Manager
        </Link>
      </div>

      <header className="mb-6 flex flex-wrap items-center gap-4 border-b border-border pb-6">
        <span className="font-mono text-sm text-text-muted">{match.match_code ?? "No ID yet"}</span>
        <EditableMatchTitle
          matchId={match.id}
          initialTitle={match.title}
          fallback={match.match_code || "Match"}
        />
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

      <div className="mb-6">
        <MatchAdminActions matchId={match.id} status={match.status} scheduledAt={match.scheduled_at} />
      </div>

      {match.status === "live" && match.entry_code && (
        <div className="mb-8 flex flex-wrap items-center gap-5 border border-accent bg-accent/10 px-5 py-4">
          <div>
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-accent">Join code</p>
            <p className="font-mono text-4xl font-extrabold tracking-[0.3em] text-accent">{match.entry_code}</p>
          </div>
          <p className="max-w-xs text-xs text-text-muted">
            Read this out to players on site. They enter it under &quot;Join live game&quot; to be added
            to this match.
          </p>
        </div>
      )}

      <div className="mb-8">
        <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Invite link
        </p>
        <CopyInviteLink code={match.invite_code} />
        <p className="mt-1.5 text-[0.65rem] text-text-subtle">
          Share this so players can view the game and sign up.
        </p>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Date / time">{fmtDateTime(match.scheduled_at, match.played_on)}</Fact>
        <Fact label="Registered">
          {match.registered_count ?? 0}
          <span className="text-text-subtle"> / {match.min_players ?? 10} min{match.max_players ? ` · ${match.max_players} max` : ""}</span>
        </Fact>
        <Fact label="Paid">
          {match.paid_count ?? 0} paid
          <span className="text-text-subtle"> · {match.on_day_count ?? 0} on the day</span>
        </Fact>
        <Fact label="Price">
          {match.price_eur != null
            ? `€${Number(match.price_eur).toFixed(2)}${match.pricing_mode === "flat" ? " flat" : " / player"}`
            : "—"}
          {match.deposit_eur != null && (
            <span className="text-text-subtle"> · €{Number(match.deposit_eur).toFixed(2)} deposit</span>
          )}
        </Fact>
        <Fact label="Rounds">{match.round_count ?? "—"}</Fact>
        <Fact label="Source file">{match.source_file_type ? match.source_file_type.toUpperCase() : "—"}</Fact>
        <Fact label="XP">
          {match.xp_distributed_at ? <span className="text-accent">Distributed</span> : <span className="text-text-subtle">Pending</span>}
        </Fact>
        <Fact label="ELO">
          {match.elo_calculated_at ? <span className="text-accent">Calculated</span> : <span className="text-text-subtle">Pending</span>}
        </Fact>
      </div>

      {/* Roster — live joins + manual admin entries */}
      {showRoster && (
        <section className="mb-10">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-[0.12em] text-accent">
            Roster ({participants.length})
          </h2>
          <p className="mb-3 text-xs text-text-muted">
            Players in the match with their headband and gun. Signed-up players join live with the
            code; add walk-ins (e.g. private-booking guests) by hand.
          </p>
          <MatchParticipantsManager matchId={match.id} initial={participants} guns={guns} payments={payments} />
        </section>
      )}

      {/* Signups (booking side) — not for private bookings */}
      {!isPlayed && !match.is_private && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.12em] text-accent">
            Signups ({signups.length})
          </h2>
          {signups.length === 0 ? (
            <p className="border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">
              No signups yet. Players sign up from the games list on their account.
            </p>
          ) : (
            <div className="overflow-x-auto border border-border">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg-elevated text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
                    <th className="px-4 py-3 font-semibold">Player</th>
                    <th className="px-4 py-3 font-semibold">Phone</th>
                    <th className="px-4 py-3 font-semibold">Paying</th>
                    <th className="px-4 py-3 font-semibold">Payment</th>
                    <th className="px-4 py-3 font-semibold">Signed up</th>
                  </tr>
                </thead>
                <tbody>
                  {signups.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-semibold text-text">
                        {s.account?.full_name || s.account?.ops_tag || "—"}
                        {s.account?.full_name && s.account?.ops_tag && (
                          <span className="ml-2 font-mono text-xs text-text-subtle">{s.account.ops_tag}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-text-muted">{s.phone || "—"}</td>
                      <td className="px-4 py-3 text-text-muted">
                        {s.payment_intent === "on_day" ? "On the day" : s.payment_intent === "online" ? "Online" : "Not chosen"}
                      </td>
                      <td className="px-4 py-3">
                        {s.paid_at ? (
                          <span className="text-accent">Paid</span>
                        ) : s.payment_intent === "on_day" ? (
                          <span className="text-amber-300">Due on day</span>
                        ) : s.payment_intent === "online" ? (
                          <span className="text-text-subtle">Unpaid</span>
                        ) : (
                          <span className="text-text-subtle">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-muted">{fmtDateTime(s.created_at, null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Entries (played side) */}
      {isPlayed && (
        <section>
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
        </section>
      )}

      {/* Ingest data (preview) */}
      <section className="mt-10">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-[0.12em] text-accent">Ingest data</h2>
        <p className="mb-3 text-xs text-text-muted">
          Upload the round JSON file(s) to preview the extracted stats. Preview only for now —
          committing stats (XP / ELO) turns on once the parser is validated against a real game
          file.
        </p>
        <IngestPanel
          matchId={match.id}
          rounds={ingestRounds}
          headbandLabels={headbandLabels}
          formula={scoreFormula}
          voidSpawn={voidSpawn}
          streakDefs={streakDefs}
        />
      </section>
    </div>
  );
}
