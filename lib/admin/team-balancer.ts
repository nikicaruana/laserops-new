/**
 * lib/admin/team-balancer.ts
 * --------------------------------------------------------------------
 * Pure team-balancing logic for the admin Team Balancer (no server/React
 * deps, usable on both server and client). Two jobs:
 *
 *  1. classifyPlayers(): turn raw per-player stats into a BalancePlayer with
 *     an ELO and a playstyle tag ("fragger" / "objective" / "balanced").
 *     A player is a FRAGGER if their kill/damage profile is clearly above the
 *     group average, an OBJECTIVE player if their capture/hold profile is, and
 *     BALANCED otherwise. Players with no stats default to balanced.
 *
 *  2. balanceTeams(): split the players into two teams that are as even as
 *     possible by total ELO (the primary objective), while also spreading the
 *     fraggers and objective players evenly (the secondary objective). A greedy
 *     ELO seed followed by best-improving swaps minimises a combined cost.
 */

export type PlayerStyle = "fragger" | "objective" | "balanced";

/** Raw per-player inputs the server gathers from player_stats_lifetime + aggregates. */
export type RawPlayer = {
  id: string; // match_participants.id
  accountId: string | null;
  name: string;
  elo: number;
  hasStats: boolean;
  killsPerRound: number;
  kd: number;
  damagePerRound: number;
  capturesPerGame: number;
  holdPerGame: number;
};

export type BalancePlayer = {
  id: string;
  accountId: string | null;
  name: string;
  elo: number;
  hasStats: boolean;
  kd: number;
  killsPerRound: number;
  style: PlayerStyle;
  /** standardised composite scores, kept for display/tie-breaks */
  fragScore: number;
  objScore: number;
};

export type TeamAssignment = { teamA: string[]; teamB: string[] };

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}
function std(xs: number[], m: number): number {
  if (xs.length < 2) return 0;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}

/** Classify players by playstyle, standardising each metric across the group. */
export function classifyPlayers(raw: RawPlayer[]): BalancePlayer[] {
  const stat = raw.filter((r) => r.hasStats);
  // Build a z-scorer for one metric across the stat-bearing players; returns a
  // no-op (0) when there isn't enough signal/variance to be meaningful.
  const scorer = (pick: (r: RawPlayer) => number) => {
    const vals = stat.map(pick);
    const m = mean(vals);
    const sd = std(vals, m);
    if (stat.length < 2 || sd === 0) return () => 0;
    return (v: number) => (v - m) / sd;
  };
  const zKpr = scorer((r) => r.killsPerRound);
  const zKd = scorer((r) => r.kd);
  const zDmg = scorer((r) => r.damagePerRound);
  const zCap = scorer((r) => r.capturesPerGame);
  const zHold = scorer((r) => r.holdPerGame);

  return raw.map((r) => {
    const fragScore = r.hasStats ? (zKpr(r.killsPerRound) + zKd(r.kd) + zDmg(r.damagePerRound)) / 3 : 0;
    const objScore = r.hasStats ? (zCap(r.capturesPerGame) + zHold(r.holdPerGame)) / 2 : 0;
    // A standout is >= 0.5 SD above the group mean on that axis.
    const TH = 0.5;
    const isFrag = fragScore >= TH;
    const isObj = objScore >= TH;
    let style: PlayerStyle = "balanced";
    if (isFrag && isObj) style = fragScore >= objScore ? "fragger" : "objective";
    else if (isFrag) style = "fragger";
    else if (isObj) style = "objective";
    return {
      id: r.id,
      accountId: r.accountId,
      name: r.name,
      elo: r.elo,
      hasStats: r.hasStats,
      kd: r.kd,
      killsPerRound: r.killsPerRound,
      style,
      fragScore,
      objScore,
    };
  });
}

// Each unit of fragger/objective imbalance is worth this many "ELO points" of
// cost. Kept modest so ELO balance stays the primary driver and playstyle only
// breaks near-ties.
const STYLE_WEIGHT = 45;

function teamTotals(ids: string[], byId: Map<string, BalancePlayer>) {
  let elo = 0;
  let frag = 0;
  let obj = 0;
  for (const id of ids) {
    const p = byId.get(id);
    if (!p) continue;
    elo += p.elo;
    if (p.style === "fragger") frag += 1;
    else if (p.style === "objective") obj += 1;
  }
  return { elo, frag, obj };
}

function cost(a: string[], b: string[], byId: Map<string, BalancePlayer>): number {
  const sa = teamTotals(a, byId);
  const sb = teamTotals(b, byId);
  return Math.abs(sa.elo - sb.elo) + STYLE_WEIGHT * (Math.abs(sa.frag - sb.frag) + Math.abs(sa.obj - sb.obj));
}

/** Split players into two ELO-balanced, playstyle-spread teams. teamA gets the extra player when odd. */
export function balanceTeams(players: BalancePlayer[]): TeamAssignment {
  const byId = new Map(players.map((p) => [p.id, p]));
  const n = players.length;
  if (n === 0) return { teamA: [], teamB: [] };
  const sizeA = Math.ceil(n / 2);
  const sizeB = n - sizeA;

  // Greedy seed: highest ELO first, into the team with the lower running ELO
  // sum (that still has room); ties broken toward spreading the playstyle.
  const sorted = [...players].sort((x, y) => y.elo - x.elo);
  const A: string[] = [];
  const B: string[] = [];
  let eloA = 0;
  let eloB = 0;
  for (const p of sorted) {
    const aFull = A.length >= sizeA;
    const bFull = B.length >= sizeB;
    let toA: boolean;
    if (aFull) toA = false;
    else if (bFull) toA = true;
    else if (eloA !== eloB) toA = eloA < eloB;
    else {
      const sa = teamTotals(A, byId);
      const sb = teamTotals(B, byId);
      if (p.style === "fragger") toA = sa.frag <= sb.frag;
      else if (p.style === "objective") toA = sa.obj <= sb.obj;
      else toA = A.length <= B.length;
    }
    if (toA) {
      A.push(p.id);
      eloA += p.elo;
    } else {
      B.push(p.id);
      eloB += p.elo;
    }
  }

  // Local search: apply the single best-improving cross-team swap until none
  // helps (keeps team sizes fixed).
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 500) {
    improved = false;
    let best = cost(A, B, byId);
    let bi = -1;
    let bj = -1;
    for (let i = 0; i < A.length; i++) {
      for (let j = 0; j < B.length; j++) {
        const na = A.slice();
        const nb = B.slice();
        const tmp = na[i];
        na[i] = nb[j];
        nb[j] = tmp;
        const c = cost(na, nb, byId);
        if (c < best - 1e-9) {
          best = c;
          bi = i;
          bj = j;
        }
      }
    }
    if (bi >= 0) {
      const tmp = A[bi];
      A[bi] = B[bj];
      B[bj] = tmp;
      improved = true;
    }
  }

  return { teamA: A, teamB: B };
}
