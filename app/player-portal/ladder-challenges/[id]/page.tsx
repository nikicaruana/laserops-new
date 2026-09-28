/**
 * app/player-portal/ladder-challenges/[id]/page.tsx
 * --------------------------------------------------------------------
 * A ladder challenge negotiation. Shows the current proposal and who it's waiting
 * on. The responding captain accepts (books the match), counters, or declines; the
 * proposing captain can withdraw. RLS limits visibility to members of either squad.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";
import { LadderChallengeNegotiate } from "@/components/portal/LadderChallengeNegotiate";

export const metadata: Metadata = { title: "Ladder Challenge" };

type Challenge = {
  id: string;
  status: string;
  team_size: number;
  proposed_at: string | null;
  proposed_by_squad: string;
  challenger_squad_id: string;
  opponent_squad_id: string;
  match_id: string | null;
  challenger: { name: string } | null;
  opponent: { name: string } | null;
};

function fmtWhen(iso: string | null): string {
  if (!iso) return "No time set";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "–"
    : d.toLocaleString("en-GB", { timeZone: "Europe/Malta", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const STATUS_LABEL: Record<string, string> = {
  negotiating: "Negotiating",
  accepted: "Accepted",
  declined: "Declined",
  cancelled: "Withdrawn",
};

export default async function LadderChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/player-portal/login?next=/player-portal/ladder-challenges/${id}`);

  const { data: c } = await supabase
    .from("ladder_challenges")
    .select("id, status, team_size, proposed_at, proposed_by_squad, challenger_squad_id, opponent_squad_id, match_id, challenger:squads!ladder_challenges_challenger_squad_id_fkey(name), opponent:squads!ladder_challenges_opponent_squad_id_fkey(name)")
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();
  const ch = c as unknown as Challenge;

  const { data: account } = await supabase.from("accounts").select("id").eq("auth_user_id", user.id).maybeSingle();
  // Which of the two squads (if any) does the viewer manage?
  const { data: managed } = account
    ? await supabase.from("squad_members").select("squad_id").eq("account_id", account.id).in("role", ["captain", "officer"]).in("squad_id", [ch.challenger_squad_id, ch.opponent_squad_id])
    : { data: [] };
  const managedIds = new Set(((managed ?? []) as { squad_id: string }[]).map((m) => m.squad_id));
  const responderSquad = ch.proposed_by_squad === ch.challenger_squad_id ? ch.opponent_squad_id : ch.challenger_squad_id;
  const negotiating = ch.status === "negotiating";
  const canRespond = negotiating && managedIds.has(responderSquad);
  const canCancel = negotiating && managedIds.has(ch.proposed_by_squad);
  const proposerName = (ch.proposed_by_squad === ch.challenger_squad_id ? ch.challenger?.name : ch.opponent?.name) ?? "A squad";

  return (
    <Container size="wide" className="py-10 sm:py-14">
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-3xl font-extrabold uppercase tracking-tight text-text sm:text-4xl">
          {ch.challenger?.name ?? "Squad"} <span className="text-text-subtle">vs</span> {ch.opponent?.name ?? "Squad"}
        </h1>
        <p className="mt-2 text-sm text-text-muted">Ladder challenge · {ch.team_size}v{ch.team_size}</p>
      </header>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="portal-card px-4 py-4">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-muted">Status</p>
          <p className="mt-1 text-lg font-extrabold text-text">{STATUS_LABEL[ch.status] ?? ch.status}</p>
        </div>
        <div className="portal-card px-4 py-4 sm:col-span-2">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-muted">Proposed time</p>
          <p className="mt-1 text-lg font-extrabold text-text">{fmtWhen(ch.proposed_at)}</p>
          {negotiating && <p className="mt-1 text-xs text-text-subtle">Proposed by {proposerName}</p>}
        </div>
      </div>

      {ch.status === "accepted" && ch.match_id ? (
        <Link href={`/player-portal/games/${ch.match_id}`} className="inline-block border border-accent bg-accent px-5 py-2.5 text-sm font-bold uppercase tracking-[0.1em] text-bg hover:bg-accent-soft">
          View the match
        </Link>
      ) : negotiating ? (
        <LadderChallengeNegotiate challengeId={ch.id} canRespond={canRespond} canCancel={canCancel} />
      ) : (
        <p className="text-sm text-text-muted">This challenge is {STATUS_LABEL[ch.status]?.toLowerCase() ?? "closed"}.</p>
      )}
    </Container>
  );
}
