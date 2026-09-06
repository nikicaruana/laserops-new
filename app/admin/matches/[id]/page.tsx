/**
 * app/admin/matches/[id]/page.tsx
 * --------------------------------------------------------------------
 * Match detail – lifecycle/processing summary, admin lifecycle actions, the
 * signups (for upcoming games) and the player entries (for played games).
 * Entry add/edit/merge and JSON/CSV ingestion arrive in later phases.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MatchStatusBadge } from "@/components/admin/MatchStatusBadge";
import { MatchAdminActions } from "@/components/admin/MatchAdminActions";
import { RescheduleMatchButton } from "@/components/admin/RescheduleMatchButton";
import { LadderResultActions } from "@/components/admin/LadderResultActions";
import { MatchSquadColours } from "@/components/admin/MatchSquadColours";
import { SignupPaidToggle } from "@/components/admin/SignupPaidToggle";
import { EditableMatchTitle } from "@/components/admin/EditableMatchTitle";
import { CopyInviteLink } from "@/components/portal/CopyInviteLink";
import { MatchParticipantsManager, type Participant, type ParticipantPayment } from "@/components/admin/MatchParticipantsManager";
import { IngestPanel, type SavedRound } from "@/components/admin/IngestPanel";
import { PublishScores } from "@/components/admin/PublishScores";
import { PublishedPlayersEditor } from "@/components/admin/PublishedPlayersEditor";
import { HeadbandIdentityPanel, type HeadbandRow } from "@/components/admin/HeadbandIdentityPanel";
import { CollapsibleSection } from "@/components/admin/CollapsibleSection";
import { RealtimeMatchRefresh } from "@/components/admin/RealtimeMatchRefresh";
import { MatchPhotosManager } from "@/components/admin/MatchPhotosManager";
import { fetchMatchPhotos } from "@/lib/match-photos";
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
  refund_status: string | null;
  created_at: string | null;
  account: { ops_tag: string | null; full_name: string | null; phone_e164: string | null } | null;
};

function fmtDateTime(iso: string | null, dateOnly: string | null): string {
  const src = iso ?? (dateOnly ? `${dateOnly}T00:00:00Z` : null);
  if (!src) return "–";
  const d = new Date(src);
  if (Number.isNaN(d.getTime())) return "–";
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
        "id, match_code, title, status, scheduled_at, played_on, round_count, source_file_type, xp_distributed_at, elo_calculated_at, winning_team_colour, is_private, is_double_xp, min_players, max_players, price_eur, pricing_mode, deposit_eur, registered_count, paid_count, on_day_count, reached_quorum_at, entry_code, invite_code, ladder_id, home_squad_id, away_squad_id, winner_squad_id, home_squad_colour, away_squad_colour",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("match_signups")
      .select("id, account_id, payment_intent, status, paid_at, refund_status, created_at, account:accounts(ops_tag, full_name, phone_e164)")
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
      .select("id, account_id, headset_label, extra_headbands, gun_used, display_name, source, payment_intent, paid_at, account:accounts(ops_tag, full_name)")
      .eq("match_id", id)
      .order("joined_at"),
    supabase.from("guns").select("name").order("name"),
    supabase
      .from("match_ingest_rounds")
      .select("id, filename, raw_file, resolutions")
      .eq("match_id", id)
      .order("created_at"),
    supabase.from("score_formula").select("structure, mode_slug"),
    supabase.from("spawn_camp_config").select("consequence_mode, protection_window_seconds, mode_slug"),
    supabase.from("streak_definitions").select("id, name, streak_key, rule").eq("is_active", true),
  ]);
  const { data: tradeRows } = await supabase
    .from("base_trading_config")
    .select("min_hold_seconds, recapture_window_seconds, recapture_same_player_points, mode_slug");

  // Photos linked to this match (Cloudinary + match_photos).
  const matchPhotos = await fetchMatchPhotos(supabase, match.id as string);

  // Ladder / casual squad-vs-squad match: names for the two squads (record the
  // winner + assign team colours). Present whenever both squads are set; ladder
  // extras (result recording) only when ladder_id is also set.
  let squadPair: { home: { id: string; name: string } | null; away: { id: string; name: string } | null } | null = null;
  let teamColours: { colour: string; label: string }[] = [];
  if (match.home_squad_id && match.away_squad_id) {
    const [{ data: sqRows }, { data: teamRows }] = await Promise.all([
      supabase.from("squads").select("id, name").in("id", [match.home_squad_id, match.away_squad_id]),
      supabase.from("teams").select("colour, display_name").eq("is_active", true).order("sort_order"),
    ]);
    const byId = new Map(((sqRows ?? []) as { id: string; name: string }[]).map((s) => [s.id, s]));
    squadPair = { home: byId.get(match.home_squad_id) ?? null, away: byId.get(match.away_squad_id) ?? null };
    teamColours = ((teamRows ?? []) as { colour: string; display_name: string | null }[]).map((t) => ({
      colour: t.colour,
      label: t.display_name || t.colour,
    }));
  }
  const isLadderMatch = Boolean(match.ladder_id);

  // Slot contention: other still-open games whose ~3h window overlaps this one.
  // The one that reaches quorum first is the natural winner; the rest are flagged
  // so an admin can cancel the loser. Read-only detection, no auto-cancel.
  type Contender = {
    id: string;
    title: string | null;
    match_code: string | null;
    status: string | null;
    scheduled_at: string | null;
    reached_quorum_at: string | null;
    registered_count: number | null;
  };
  let contenders: Contender[] = [];
  if (match.scheduled_at && ["tentative", "awaiting_confirm", "confirmed"].includes(match.status ?? "")) {
    const t = new Date(match.scheduled_at).getTime();
    const WINDOW_MS = 3 * 60 * 60 * 1000;
    const { data: cRows } = await supabase
      .from("matches")
      .select("id, title, match_code, status, scheduled_at, reached_quorum_at, registered_count")
      .neq("id", match.id)
      .in("status", ["tentative", "awaiting_confirm", "confirmed"])
      .gte("scheduled_at", new Date(t - WINDOW_MS).toISOString())
      .lte("scheduled_at", new Date(t + WINDOW_MS).toISOString());
    contenders = (cRows ?? []) as Contender[];
  }
  // Who reached quorum first across this match + its contenders (null = not yet).
  const quorumTimes = [
    { id: match.id, at: match.reached_quorum_at as string | null, self: true },
    ...contenders.map((c) => ({ id: c.id, at: c.reached_quorum_at, self: false })),
  ].filter((x) => x.at);
  quorumTimes.sort((a, b) => new Date(a.at!).getTime() - new Date(b.at!).getTime());
  const firstToQuorum = quorumTimes[0] ?? null;
  // Exploit Control: spawn-protection window (spawn_camp_config) drives the
  // parser's spawn-kill/damage flagging, so parsing reads the admin's setting
  // rather than a hardcoded window.
  const spawnWindowSeconds =
    ((spawnRows ?? []) as { protection_window_seconds: number | null; mode_slug: string | null }[])
      .find((r) => r.mode_slug === "domination")?.protection_window_seconds ?? undefined;

  // Re-parse the stored raw file with the CURRENT parser on every load, so
  // parser improvements show without re-uploading. Falls back to nothing on a
  // parse error.
  const ingestRounds: SavedRound[] = ((ingestRows ?? []) as { id: string; filename: string | null; raw_file: string | null; resolutions: Record<string, unknown> | null }[])
    .map((row) => {
      if (!row.raw_file) return null;
      try {
        return { id: row.id, filename: row.filename, parsed: parseRound(row.raw_file, { spawnWindowSeconds }), resolutions: (row.resolutions ?? {}) as SavedRound["resolutions"] };
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
  const tRows = (tradeRows ?? []) as {
    min_hold_seconds: number | null;
    recapture_window_seconds: number | null;
    recapture_same_player_points: number | null;
    mode_slug: string | null;
  }[];
  const tRow = tRows.find((r) => r.mode_slug === "domination") ?? tRows[0];
  const tradeMinHoldSeconds = tRow?.min_hold_seconds ?? null;
  const recaptureWindowSeconds = tRow?.recapture_window_seconds ?? null;
  const recapturePoints = tRow?.recapture_same_player_points ?? null;

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
  // headband number -> roster link state, for the identity-resolution panel.
  const rosterByHeadband: Record<number, { linked: boolean; label: string | null; temp_name: string | null; participant_id: string }> = {};
  for (const p of participants) {
    const label = p.account?.ops_tag || p.account?.full_name || p.display_name;
    if (label) {
      for (const hb of [p.headset_label, ...(p.extra_headbands ?? [])]) {
        const n = hb ? parseInt(hb, 10) : NaN;
        if (!Number.isNaN(n)) headbandLabels[n] = label;
      }
    }
    for (const hb of [p.headset_label, ...(p.extra_headbands ?? [])]) {
      const n = hb ? parseInt(hb, 10) : NaN;
      if (Number.isNaN(n)) continue;
      const linked = Boolean(p.account_id);
      // A linked entry always wins over an unlinked one for the same headband.
      if (!rosterByHeadband[n] || (linked && !rosterByHeadband[n].linked)) {
        rosterByHeadband[n] = {
          linked,
          label: p.account?.ops_tag || p.account?.full_name || null,
          temp_name: p.display_name || null,
          participant_id: p.id,
        };
      }
    }
  }

  // Distinct headbands seen across all ingested rounds -> identity-resolution rows.
  const ingestedHeadbands = new Set<number>();
  for (const r of ingestRounds) {
    for (const pl of r.parsed.players) {
      if (pl.headband_no != null) ingestedHeadbands.add(pl.headband_no);
    }
  }
  const headbandRows: HeadbandRow[] = [...ingestedHeadbands]
    .sort((a, b) => a - b)
    .map((hb) => {
      const roster = rosterByHeadband[hb];
      if (roster?.linked) return { headband: hb, status: "linked", label: roster.label, temp_name: roster.temp_name, participant_id: roster.participant_id };
      if (roster) return { headband: hb, status: "walkin", label: roster.label, temp_name: roster.temp_name, participant_id: roster.participant_id };
      return { headband: hb, status: "unclaimed", label: null, temp_name: null, participant_id: null };
    });

  return (
    <div>
      <RealtimeMatchRefresh matchId={match.id} />
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

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <MatchAdminActions matchId={match.id} status={match.status} scheduledAt={match.scheduled_at} />
        <RescheduleMatchButton matchId={match.id} status={match.status} scheduledAt={match.scheduled_at} />
      </div>

      {squadPair?.home && squadPair.away && (
        <div className="mb-8 space-y-4">
          <MatchSquadColours
            matchId={match.id}
            homeName={squadPair.home.name}
            awayName={squadPair.away.name}
            colours={teamColours}
            initialHomeColour={match.home_squad_colour}
            initialAwayColour={match.away_squad_colour}
          />
          {isLadderMatch && (
            <LadderResultActions
              matchId={match.id}
              homeSquadId={squadPair.home.id}
              homeName={squadPair.home.name}
              homeColour={match.home_squad_colour}
              awaySquadId={squadPair.away.id}
              awayName={squadPair.away.name}
              awayColour={match.away_squad_colour}
              winnerSquadId={match.winner_squad_id}
            />
          )}
        </div>
      )}

      {contenders.length > 0 && (
        <div className="mb-8 border border-amber-700 bg-amber-950/30 px-5 py-4">
          <p className="text-sm font-bold uppercase tracking-[0.1em] text-amber-300">
            Slot contention · {contenders.length} overlapping game{contenders.length === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {firstToQuorum
              ? firstToQuorum.self
                ? "This game reached quorum first – it's the one to keep."
                : "Another overlapping game reached quorum first. Consider cancelling this one."
              : "None have reached quorum yet. The first to hit its minimum is the one to keep."}
          </p>
          <ul className="mt-3 space-y-1.5">
            {contenders.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 text-xs">
                <Link href={`/admin/matches/${c.id}`} className="font-semibold text-accent hover:text-accent-soft">
                  {c.title || c.match_code || "Match"}
                </Link>
                <span className="text-text-muted">{fmtDateTime(c.scheduled_at, null)}</span>
                <MatchStatusBadge status={c.status} />
                <span className="text-text-subtle">{c.registered_count ?? 0} registered</span>
                {c.reached_quorum_at && (
                  <span className={firstToQuorum && firstToQuorum.id === c.id ? "font-bold text-amber-300" : "text-text-subtle"}>
                    quorum {fmtDateTime(c.reached_quorum_at, null)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

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
            : "–"}
          {match.deposit_eur != null && (
            <span className="text-text-subtle"> · €{Number(match.deposit_eur).toFixed(2)} deposit</span>
          )}
        </Fact>
        <Fact label="Rounds">{match.round_count ?? "–"}</Fact>
        <Fact label="Source file">{match.source_file_type ? match.source_file_type.toUpperCase() : "–"}</Fact>
        <Fact label="XP">
          {match.xp_distributed_at ? <span className="text-accent">Distributed</span> : <span className="text-text-subtle">Pending</span>}
        </Fact>
        <Fact label="ELO">
          {match.elo_calculated_at ? <span className="text-accent">Calculated</span> : <span className="text-text-subtle">Pending</span>}
        </Fact>
      </div>

      {/* Signed in players – live joins + manual admin entries */}
      {showRoster && (
        <CollapsibleSection
          title="Signed in players"
          count={participants.length}
          subtitle="Players in the match with their headband and gun. Signed-up players join live with the code; add walk-ins (e.g. private-booking guests) by hand."
        >
          <MatchParticipantsManager matchId={match.id} initial={participants} guns={guns} payments={payments} />
        </CollapsibleSection>
      )}

      {/* Signups (booking side) – not for private bookings */}
      {!isPlayed && !match.is_private && (
        <CollapsibleSection title="Signups" count={signups.length}>
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
                        {s.account?.full_name || s.account?.ops_tag || "–"}
                        {s.account?.full_name && s.account?.ops_tag && (
                          <span className="ml-2 font-mono text-xs text-text-subtle">{s.account.ops_tag}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-text-muted">{s.account?.phone_e164 || "–"}</td>
                      <td className="px-4 py-3 text-text-muted">
                        {s.payment_intent === "on_day" ? "On the day" : s.payment_intent === "online" ? "Online" : "Not chosen"}
                      </td>
                      <td className="px-4 py-3">
                        {s.account_id ? (
                          <SignupPaidToggle matchId={match.id} accountId={s.account_id} initialPaid={Boolean(s.paid_at)} intent={s.payment_intent} refundStatus={s.refund_status ?? null} />
                        ) : (
                          <span className="text-text-subtle">–</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-muted">{fmtDateTime(s.created_at, null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Entries (played side) */}
      {isPlayed && (
        <CollapsibleSection title="Player entries" count={entries.length}>
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
                        <span className="font-semibold text-text">{e.nickname ?? "–"}</span>
                        {e.was_winner && <span className="ml-2 text-[0.6rem] font-bold uppercase text-accent">Win</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-text-muted">{e.headset_label ?? "–"}</td>
                      <td className="px-4 py-3 text-text-muted">{e.team_colour ?? "–"}</td>
                      <td className="px-4 py-3 text-text-muted">{e.gun_used ?? "–"}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-text">{e.score ?? "–"}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-text-muted">{e.frags ?? "–"}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-text-muted">{e.deaths ?? "–"}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-text-muted">
                        {e.kd === null || e.kd === undefined ? "–" : e.kd.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-text-muted">
                        {e.accuracy === null || e.accuracy === undefined ? "–" : `${Math.round(e.accuracy * 100)}%`}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-text-muted">{e.xp_total ?? "–"}</td>
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
        </CollapsibleSection>
      )}

      {/* Identity resolution – link ingested headbands to real profiles */}
      {headbandRows.length > 0 && (
        <CollapsibleSection
          title="Identity resolution"
          count={headbandRows.length}
          subtitle="Every headband from the round files. Link each to a real profile so the committed stats, XP and ELO land on the right player. Walk-ins added by hand can be linked too."
        >
          <HeadbandIdentityPanel matchId={match.id} rows={headbandRows} />
        </CollapsibleSection>
      )}

      {/* Ingest data (preview) */}
      <CollapsibleSection
        title="Ingest data"
        subtitle="Upload the round JSON file(s) to preview the extracted stats. Preview only for now; committing stats (XP / ELO) turns on once the parser is validated against a real game file."
      >
        <IngestPanel
          matchId={match.id}
          rounds={ingestRounds}
          headbandLabels={headbandLabels}
          formula={scoreFormula}
          voidSpawn={voidSpawn}
          streakDefs={streakDefs}
          tradeMinHoldSeconds={tradeMinHoldSeconds}
          spawnWindowSeconds={spawnWindowSeconds}
          recaptureWindowSeconds={recaptureWindowSeconds}
          recapturePoints={recapturePoints}
        />
      </CollapsibleSection>

      {/* Publish scores (commit step) */}
      {ingestRounds.length > 0 && (
        <CollapsibleSection
          title="Publish scores"
          subtitle="Make the results official: writes each player's score, accolades and XP from the reviewed rounds and marks the match scored. Requires 2FA; blocked while any capture ambiguity is unreviewed. Re-publishing replaces this match's committed rows. (ELO is a later phase.)"
        >
          <PublishScores matchId={match.id} alreadyPublished={!!match.xp_distributed_at} />
        </CollapsibleSection>
      )}

      {/* Edit published players – reassign a headband to a profile / set the gun */}
      {match.xp_distributed_at && entries.length > 0 && (
        <CollapsibleSection
          title="Edit players"
          count={entries.length}
          subtitle="After publishing, reassign a headband to a profile (e.g. a walk-in who made an account later) or set the gun. Saving re-attributes that player's stats and rolls it into their career — scores and XP amounts aren't recomputed. Requires 2FA."
        >
          <PublishedPlayersEditor
            matchId={match.id}
            guns={guns}
            players={entries.map((e) => ({
              headset_label: e.headset_label ?? "",
              nickname: e.nickname ?? (e.headset_label ?? ""),
              team_colour: e.team_colour,
              gun_used: e.gun_used,
              account_id: e.account_id,
            }))}
          />
        </CollapsibleSection>
      )}

      {/* Match photos – uploaded to Cloudinary + the gallery, shown in the report */}
      <CollapsibleSection
        title="Photos"
        count={matchPhotos.length}
        subtitle="Upload photos from this match. They appear in the match report's Images section and in the public gallery. Players can tag themselves from the report."
      >
        <MatchPhotosManager
          matchId={match.id}
          initial={matchPhotos.map((p) => ({ id: p.id, url: p.url, caption: p.caption, width: p.width, height: p.height, taggedOps: p.taggedOps }))}
        />
      </CollapsibleSection>
    </div>
  );
}
