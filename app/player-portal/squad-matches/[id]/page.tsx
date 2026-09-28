/**
 * app/player-portal/squad-matches/[id]/page.tsx
 * --------------------------------------------------------------------
 * A squad-vs-squad match: the two squads, date/time, team size, and per-side
 * signups. Members of either side can sign up (unless they're in both squads).
 * Auth-gated.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";
import { SquadMatchSignupButton } from "@/components/portal/SquadMatchSignupButton";

export const metadata: Metadata = { title: "Squad Match" };

function fmtDateTime(iso: string | null): string {
  if (!iso) return "Date TBC";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date TBC";
  return d.toLocaleString("en-GB", { timeZone: "Europe/Malta", weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function SquadColumn({ name, squadId, signups }: { name: string; squadId: string; signups: { ops_tag: string | null }[] }) {
  return (
    <div className="portal-card p-5">
      <Link href={`/player-portal/squads/${squadId}`} className="text-lg font-extrabold uppercase tracking-tight text-text hover:text-accent">
        {name}
      </Link>
      <p className="mb-3 mt-1 text-xs text-text-muted">{signups.length} signed up</p>
      <ul className="space-y-1.5">
        {signups.map((s, i) => (
          <li key={i} className="text-sm text-text">{s.ops_tag || "Player"}</li>
        ))}
        {signups.length === 0 && <li className="text-sm text-text-subtle">No one yet.</li>}
      </ul>
    </div>
  );
}

export default async function SquadMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/player-portal/login?next=/player-portal/squad-matches/${id}`);
  const { data: account } = await supabase.from("accounts").select("id").eq("auth_user_id", user.id).maybeSingle();

  const { data: match } = await supabase
    .from("squad_matches")
    .select("id, home_squad_id, away_squad_id, scheduled_at, team_size, status")
    .eq("id", id)
    .maybeSingle();
  if (!match) notFound();

  const { data: squadRows } = await supabase.from("squads").select("id, name").in("id", [match.home_squad_id, match.away_squad_id]);
  const nameOf = new Map(((squadRows ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]));

  // My side + whether I've signed up.
  let inHome = false;
  let inAway = false;
  let signedUp = false;
  if (account) {
    const { data: myMems } = await supabase.from("squad_members").select("squad_id").eq("account_id", account.id).in("squad_id", [match.home_squad_id, match.away_squad_id]);
    inHome = (myMems ?? []).some((m) => m.squad_id === match.home_squad_id);
    inAway = (myMems ?? []).some((m) => m.squad_id === match.away_squad_id);
    const { data: mySignup } = await supabase.from("squad_match_signups").select("id").eq("squad_match_id", id).eq("account_id", account.id).maybeSingle();
    signedUp = Boolean(mySignup);
  }
  const isParticipant = inHome || inAway;

  const { data: signupRows } = isParticipant
    ? await supabase.rpc("squad_match_signup_list", { p_squad_match_id: id })
    : { data: null };
  const signups = (signupRows ?? []) as { ops_tag: string | null; squad_id: string }[];
  const homeSignups = signups.filter((s) => s.squad_id === match.home_squad_id);
  const awaySignups = signups.filter((s) => s.squad_id === match.away_squad_id);

  return (
    <Container size="wide" className="py-10 sm:py-14">
      <div className="mb-6 text-xs">
        <Link href="/player-portal/squads" className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
          ← Squads
        </Link>
      </div>

      <header className="border-b border-border pb-6 text-center">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">Squad match</p>
        <h1 className="mt-1 text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
          {nameOf.get(match.home_squad_id)} <span className="text-text-subtle">vs</span> {nameOf.get(match.away_squad_id)}
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          {fmtDateTime(match.scheduled_at)}
          {match.team_size ? ` · ${match.team_size} v ${match.team_size}` : ""}
        </p>
      </header>

      <section className="mt-8 flex flex-col items-center gap-3">
        {!account || !isParticipant ? (
          <p className="text-sm text-text-muted">Only members of the two squads can sign up.</p>
        ) : inHome && inAway ? (
          <p className="text-sm text-amber-300">Your squads are facing each other – you sit this one out.</p>
        ) : signedUp ? (
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-accent">✓ You&apos;re signed up</p>
        ) : (
          <SquadMatchSignupButton matchId={id} />
        )}
      </section>

      {isParticipant && (
        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <SquadColumn name={nameOf.get(match.home_squad_id) ?? "Home"} squadId={match.home_squad_id} signups={homeSignups} />
          <SquadColumn name={nameOf.get(match.away_squad_id) ?? "Away"} squadId={match.away_squad_id} signups={awaySignups} />
        </section>
      )}
    </Container>
  );
}
