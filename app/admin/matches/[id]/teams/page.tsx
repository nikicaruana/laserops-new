/**
 * app/admin/matches/[id]/teams/page.tsx
 * --------------------------------------------------------------------
 * Admin Team Balancer for one game. Gathers the roster + each player's ELO
 * (player_stats_lifetime.current_elo, walk-ins default to Team_Builder_Unknown_ELO)
 * and playstyle inputs (fragger stats from lifetime, objective stats aggregated
 * from match_player_aggregate), classifies each player, computes an initial
 * ELO-balanced + playstyle-spread split, and hands it to the drag-and-drop
 * <TeamBalancer>. Admin-gated by the /admin layout.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TeamBalancer } from "@/components/admin/TeamBalancer";
import { classifyPlayers, balanceTeams, type RawPlayer, type TeamAssignment } from "@/lib/admin/team-balancer";

export const metadata: Metadata = { title: "Create teams" };

type Embedded = { ops_tag: string | null; full_name: string | null };
type ParticipantRow = {
  id: string;
  account_id: string | null;
  display_name: string | null;
  headset_label: string | null;
  assigned_team: string | null;
  account: Embedded | Embedded[] | null;
};

const one = (a: Embedded | Embedded[] | null): Embedded | null => (Array.isArray(a) ? (a[0] ?? null) : a);

export default async function TeamBalancerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: match } = await supabase.from("matches").select("id, title, match_code, scheduled_at").eq("id", id).maybeSingle();
  if (!match) notFound();

  const { data: partData } = await supabase
    .from("match_participants")
    .select("id, account_id, display_name, headset_label, assigned_team, account:accounts(ops_tag, full_name)")
    .eq("match_id", id)
    .order("joined_at");
  const participants = (partData ?? []) as ParticipantRow[];
  const accountIds = [...new Set(participants.map((p) => p.account_id).filter((x): x is string => Boolean(x)))];

  // ELO + fragger stats
  const lifetime = new Map<string, { elo: number | null; kpr: number; kd: number; dmg: number; games: number }>();
  if (accountIds.length) {
    const { data } = await supabase
      .from("player_stats_lifetime")
      .select("account_id, current_elo, kills_per_round, avg_kd, damage_per_round, games")
      .in("account_id", accountIds);
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      lifetime.set(r.account_id as string, {
        elo: r.current_elo == null ? null : Number(r.current_elo),
        kpr: Number(r.kills_per_round) || 0,
        kd: Number(r.avg_kd) || 0,
        dmg: Number(r.damage_per_round) || 0,
        games: Number(r.games) || 0,
      });
    }
  }

  // Objective stats: aggregate captures + hold_seconds across the player's matches.
  const objective = new Map<string, { caps: number; hold: number; n: number }>();
  if (accountIds.length) {
    const { data } = await supabase.from("match_player_aggregate").select("account_id, captures, hold_seconds").in("account_id", accountIds);
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      const acc = r.account_id as string;
      const cur = objective.get(acc) ?? { caps: 0, hold: 0, n: 0 };
      cur.caps += Number(r.captures) || 0;
      cur.hold += Number(r.hold_seconds) || 0;
      cur.n += 1;
      objective.set(acc, cur);
    }
  }

  // Unknown-ELO default for walk-ins / no-rating players.
  let unknownElo = 900;
  {
    const { data } = await supabase.from("elo_config").select("value").eq("key", "Team_Builder_Unknown_ELO").maybeSingle();
    const v = data?.value == null ? NaN : Number(data.value);
    if (Number.isFinite(v) && v > 0) unknownElo = v;
  }

  // Team colour options.
  const { data: teamsData } = await supabase.from("teams").select("colour, display_name").eq("is_active", true).order("sort_order");
  const colourOptions =
    (teamsData ?? []).length > 0
      ? (teamsData as { colour: string; display_name: string | null }[]).map((t) => ({ colour: t.colour, label: t.display_name || t.colour }))
      : [
          { colour: "Blue", label: "Blue" },
          { colour: "Yellow", label: "Yellow" },
          { colour: "Red", label: "Red" },
          { colour: "Green", label: "Green" },
        ];

  // Build raw players.
  const raw: RawPlayer[] = participants.map((p) => {
    const acc = one(p.account);
    const name = (acc?.ops_tag || acc?.full_name || p.display_name || "Walk-in").trim();
    const lt = p.account_id ? lifetime.get(p.account_id) : undefined;
    const obj = p.account_id ? objective.get(p.account_id) : undefined;
    const hasStats = !!lt && lt.games > 0;
    return {
      id: p.id,
      accountId: p.account_id,
      name,
      elo: lt?.elo != null ? lt.elo : unknownElo,
      hasStats,
      killsPerRound: lt?.kpr ?? 0,
      kd: lt?.kd ?? 0,
      damagePerRound: lt?.dmg ?? 0,
      capturesPerGame: obj && obj.n > 0 ? obj.caps / obj.n : 0,
      holdPerGame: obj && obj.n > 0 ? obj.hold / obj.n : 0,
    };
  });
  const players = classifyPlayers(raw);

  // Initial assignment: reuse saved teams if present, else auto-balance.
  let initial: TeamAssignment;
  let defaultColourA = "Blue";
  let defaultColourB = "Yellow";
  const savedColours = [...new Set(participants.map((p) => p.assigned_team).filter((x): x is string => Boolean(x)))];
  if (savedColours.length >= 1 && participants.some((p) => p.assigned_team)) {
    defaultColourA = savedColours[0];
    defaultColourB = savedColours[1] ?? colourOptions.find((o) => o.colour !== defaultColourA)?.colour ?? "Yellow";
    const teamA = participants.filter((p) => p.assigned_team === defaultColourA).map((p) => p.id);
    const teamB = participants.filter((p) => p.assigned_team === defaultColourB).map((p) => p.id);
    const placed = new Set([...teamA, ...teamB]);
    for (const p of participants) {
      if (placed.has(p.id)) continue;
      if (teamA.length <= teamB.length) teamA.push(p.id);
      else teamB.push(p.id);
    }
    initial = { teamA, teamB };
  } else {
    initial = balanceTeams(players);
  }

  const label = match.title || match.match_code || "Game";

  return (
    <div>
      <header className="mb-6 border-b border-border pb-5">
        <Link href={`/admin/matches/${match.id}`} className="text-xs font-semibold uppercase tracking-[0.14em] text-text-subtle transition-colors hover:text-accent">
          ← Back to game
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Create teams</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          {label} · {players.length} players. Balanced by ELO, with fraggers and objective players spread across both teams. Drag to adjust, then save.
        </p>
      </header>

      {players.length === 0 ? (
        <p className="border border-border bg-bg-elevated px-4 py-6 text-sm text-text-muted">No players on this game's roster yet. Add players from the game page first.</p>
      ) : (
        <TeamBalancer
          matchId={match.id}
          players={players}
          colourOptions={colourOptions}
          initial={initial}
          defaultColourA={defaultColourA}
          defaultColourB={defaultColourB}
        />
      )}
    </div>
  );
}
