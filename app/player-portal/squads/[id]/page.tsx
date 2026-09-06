/**
 * app/player-portal/squads/[id]/page.tsx
 * --------------------------------------------------------------------
 * A squad's main page: badge, name, description, and a grid of member cards
 * (photo, ops tag, main rating, ELO). Managers (captain/officer) see a "Manage
 * squad" link to the management page. Visible to members, admins, and anyone if
 * the squad is searchable (RLS). Auth-gated.
 */
import type { Metadata } from "next";
import { cldImage } from "@/lib/cld";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";
import { RatingPill } from "@/components/portal/player-summary/RatingPill";
import { RequestToJoinButton } from "@/components/portal/RequestToJoinButton";
import { BracketFrame } from "@/components/portal/BracketFrame";
import { SquadLeaderboardTable, type SquadLeaderRow } from "@/components/portal/SquadLeaderboardTable";

export const metadata: Metadata = { title: "Squad" };

type Member = {
  account_id: string;
  ops_tag: string | null;
  profile_pic_url: string | null;
  role: string;
  is_primary: boolean;
  stars: number | null;
  level: number | null;
  rank_badge_url: string | null;
};

const roleLabel: Record<string, string> = { captain: "Captain", officer: "Officer", member: "Member" };

function squareUrl(url: string, w = 200): string {
  return url.includes("/upload/") ? url.replace("/upload/", `/upload/c_fill,ar_1:1,g_auto,w_${w},q_auto,f_auto/`) : url;
}

const TABS = [
  { key: "members", label: "Members" },
  { key: "leaderboard", label: "Leaderboard" },
  { key: "matches", label: "Upcoming matches" },
];

type SquadMatch = {
  id: string;
  home_squad_id: string;
  home_name: string;
  away_squad_id: string;
  away_name: string;
  scheduled_at: string | null;
  team_size: number | null;
  status: string;
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return "Date TBC";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date TBC";
  return d.toLocaleString("en-GB", { timeZone: "Europe/Malta", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function SquadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab = TABS.find((t) => t.key === tab)?.key ?? "members";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/player-portal/login?next=/player-portal/squads/${id}`);
  const { data: account } = await supabase.from("accounts").select("id").eq("auth_user_id", user.id).maybeSingle();

  const { data: squad } = await supabase
    .from("squads")
    .select("id, name, description, badge_url, is_searchable, member_count")
    .eq("id", id)
    .maybeSingle();
  if (!squad) notFound();

  const { data: rosterRows } = await supabase.rpc("squad_roster", { p_squad_id: id });
  const roster = (rosterRows ?? []) as Member[];
  const me = account ? roster.find((m) => m.account_id === account.id) : undefined;
  const canManage = me?.role === "captain" || me?.role === "officer";

  // Non-member of a publicly-joinable squad can request to join.
  let alreadyRequested = false;
  if (!me && account && squad.is_searchable) {
    const { data: reqRow } = await supabase
      .from("squad_join_requests")
      .select("id")
      .eq("squad_id", id)
      .eq("account_id", account.id)
      .eq("status", "pending")
      .maybeSingle();
    alreadyRequested = Boolean(reqRow);
  }

  // "Challenge squad": the viewer manages a squad OTHER than this one.
  let canChallenge = false;
  if (account) {
    const { data: managed } = await supabase
      .from("squad_members")
      .select("squad_id")
      .eq("account_id", account.id)
      .in("role", ["captain", "officer"])
      .neq("squad_id", id);
    canChallenge = (managed ?? []).length > 0;
  }

  // Upcoming matches tab data.
  let matches: SquadMatch[] = [];
  if (activeTab === "matches") {
    const { data: matchRows } = await supabase.rpc("squad_matches_for_squad", { p_squad_id: id });
    matches = (matchRows ?? []) as SquadMatch[];
  }

  // Leaderboard tab data.
  let leaderboard: SquadLeaderRow[] = [];
  if (activeTab === "leaderboard") {
    const { data: lbRows } = await supabase.rpc("squad_leaderboard", { p_squad_id: id });
    leaderboard = (lbRows ?? []) as SquadLeaderRow[];
  }

  return (
    <Container size="wide" className="py-10 sm:py-14">
      <div className="mb-6 text-xs">
        <Link href="/player-portal/squads" className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
          ← Squads
        </Link>
      </div>

      <header className="flex flex-wrap items-center gap-5 border-b border-border pb-6">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-bg-overlay text-2xl font-bold text-text-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {squad.badge_url ? <img src={cldImage(squareUrl(squad.badge_url), { w: 384 })} alt="" className="h-full w-full object-cover" /> : squad.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-extrabold uppercase tracking-tight text-text sm:text-4xl">{squad.name}</h1>
          <p className="mt-1 text-sm text-text-muted">
            {squad.member_count ?? roster.length}/20 members{squad.is_searchable ? " · publicly joinable" : " · invite-only"}
          </p>
          {squad.description && <p className="mt-2 max-w-2xl text-sm text-text-muted">{squad.description}</p>}
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
          {!me && canChallenge && (
            <Link
              href={`/player-portal/squads/${id}/challenge`}
              className="flex h-11 items-center border border-accent bg-accent px-5 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98]"
            >
              Challenge squad
            </Link>
          )}
          {canManage && (
            <Link
              href={`/player-portal/squads/${id}/manage`}
              className="flex h-11 items-center border border-border-strong px-5 text-xs font-bold uppercase tracking-[0.12em] text-text transition-colors hover:border-accent hover:text-accent"
            >
              Manage squad
            </Link>
          )}
        </div>
      </header>

      {/* Tabs – single line, horizontally scrollable on narrow screens */}
      <div className="mt-6 flex flex-nowrap gap-2 overflow-x-auto border-b border-border [-ms-overflow-style:none] [scrollbar-width:none]">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "members" ? `/player-portal/squads/${id}` : `/player-portal/squads/${id}?tab=${t.key}`}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] ${
              t.key === activeTab ? "border-accent text-accent" : "border-transparent text-text-muted hover:text-accent"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Leaderboard tab */}
      {activeTab === "leaderboard" && (
        <section className="mt-8">
          {leaderboard.length === 0 ? (
            <p className="border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">
              No stats yet.
            </p>
          ) : (
            <SquadLeaderboardTable rows={leaderboard} />
          )}
        </section>
      )}

      {/* Upcoming matches tab */}
      {activeTab === "matches" && (
        <section className="mt-8">
          {matches.length === 0 ? (
            <p className="border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">
              No upcoming matches. {canChallenge && !me ? "Challenge this squad to start one." : ""}
            </p>
          ) : (
            <ul className="space-y-3">
              {matches.map((mt) => (
                <li key={mt.id}>
                  <Link href={`/player-portal/squad-matches/${mt.id}`} className="flex flex-wrap items-center justify-between gap-3 border border-border bg-bg-elevated px-5 py-4 transition-colors hover:border-accent">
                    <span className="text-sm font-bold text-text">
                      {mt.home_name} <span className="text-text-subtle">vs</span> {mt.away_name}
                    </span>
                    <span className="text-xs text-text-muted">
                      {fmtDateTime(mt.scheduled_at)}
                      {mt.team_size ? ` · ${mt.team_size}v${mt.team_size}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Member cards */}
      {activeTab === "members" && (
      <section className="mt-8">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.12em] text-accent">Members ({roster.length})</h2>
        {me == null && (
          <div className="mb-4 flex flex-col items-center gap-2 border border-dashed border-border px-4 py-5 text-center">
            {squad.is_searchable ? (
              <RequestToJoinButton squadId={id} alreadyRequested={alreadyRequested} />
            ) : (
              <p className="text-xs text-text-muted">Ask a member for their invite link to join this squad.</p>
            )}
          </div>
        )}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roster.map((m) => (
            <li key={m.account_id} className="flex flex-col items-center gap-3 border border-border bg-bg-elevated p-5 text-center">
              {/* Ops tag above */}
              <div className="flex items-center gap-2">
                {m.ops_tag ? (
                  <Link href={`/player-portal/player-stats/summary?ops=${encodeURIComponent(m.ops_tag)}`} className="text-lg font-extrabold uppercase tracking-tight text-text hover:text-accent">
                    {m.ops_tag}
                  </Link>
                ) : (
                  <span className="text-lg font-extrabold uppercase tracking-tight text-text">Player</span>
                )}
                {m.role !== "member" && (
                  <span className="text-[0.55rem] font-bold uppercase tracking-[0.12em] text-accent">{roleLabel[m.role]}</span>
                )}
              </div>

              {/* Square profile picture with the 4-corner bracket frame + rating pill overlapping its base */}
              <div className="relative">
                <BracketFrame cornerSize="1.5rem" inset="-6px">
                  <div className="aspect-square w-44 overflow-hidden bg-bg-overlay">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {m.profile_pic_url ? (
                      <img src={cldImage(squareUrl(m.profile_pic_url, 320), { w: 384 })} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-text-muted">{(m.ops_tag || "P").slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                </BracketFrame>
                <RatingPill
                  ratingImageUrl={`_${m.stars ?? 0}_Star`}
                  pillClassName="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 translate-y-1/2 rounded-full bg-bg/85 px-3 py-1 backdrop-blur-sm"
                  iconImgClassName="block h-3.5 w-auto"
                />
              </div>

              {/* Level + rank badge below (extra top gap to clear the overlapped pill) */}
              <div className="mt-8 flex items-center gap-3">
                {m.rank_badge_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cldImage(m.rank_badge_url, { w: 384 })} alt="" className="h-12 w-auto" />
                )}
                <span className="text-xl font-extrabold text-text">{m.level != null ? `Level ${m.level}` : "Unranked"}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
      )}
    </Container>
  );
}
