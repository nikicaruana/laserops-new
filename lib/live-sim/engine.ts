/**
 * lib/live-sim/engine.ts
 * --------------------------------------------------------------------
 * The live-view state engine: a round is a timeline of events + base flips, and
 * every on-screen value is a PURE function of (round, t). The admin sim advances
 * t on a replay clock; the real live views set t from the producer's snapshot
 * (elapsed seconds) plus local wall-clock so timers tick smoothly between pushes.
 * Shared by components/admin/LiveSim, components/live/LiveRoundView, and the
 * producer (lib/live-sim/build-round).
 */
export type Ev = { t: number; type: "kill" | "capture" | "respawn"; actor?: string; victim?: string; spawn?: boolean; pid?: string; base?: string; team?: string };
export type SimPlayer = { name: string; team: string; gunName: string; gunImage: string };
export type Base = { id: number; name: string };
export type RoundData = {
  round: number; winner: string | null; durationSeconds: number; teams: string[];
  players: SimPlayer[]; bases: Base[];
  baseFlips: { t: number; baseId: number; team: string }[];
  burns: { baseId: number; team: string; t: number }[];
  burnThresholdSeconds: number; events: Ev[];
};
export type MatchData = { label: string; rounds: RoundData[] };

export const BASE_IMAGES: Record<string, string> = {
  blue: "https://res.cloudinary.com/dqud5b7pa/image/upload/v1788695676/Capture-Base-Blue_vgfkcw.png",
  yellow: "https://res.cloudinary.com/dqud5b7pa/image/upload/v1788695676/Capture-Base-Yellow_gs2dzo.png",
  red: "https://res.cloudinary.com/dqud5b7pa/image/upload/v1788695676/Capture-Base-Red_mjgf1b.png",
  neutral: "https://res.cloudinary.com/dqud5b7pa/image/upload/v1788702466/Capture-Base-Grey_ssigi0.png",
};
const TEAM_HEX: Record<string, string> = { Blue: "#3b82f6", Yellow: "#eab308", Red: "#ef4444", Green: "#22c55e" };
export const teamHex = (c: string | null) => (c && TEAM_HEX[c]) || "#6b7280";
export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
export const sb = (key: string) => `https://res.cloudinary.com/dqud5b7pa/image/upload/laseropsmalta.com/streak-badges/${key}.png`;

/** When the round's view should stop advancing (2nd base burn + a beat). */
export function simEndOf(r: RoundData): number {
  const byTeam: Record<string, number[]> = {};
  for (const b of r.burns) (byTeam[b.team] ??= []).push(b.t);
  let end = r.durationSeconds;
  for (const tm in byTeam) { const s = byTeam[tm].sort((a, b) => a - b); if (s.length >= 2) end = Math.min(end, s[1]); }
  return Math.min(r.durationSeconds, end + 3);
}

export type Stat = { name: string; team: string; kills: number; deaths: number; caps: number; streak: number; best: number; score: number };
export function statsAt(data: RoundData, t: number): Map<string, Stat> {
  const per = new Map<string, Stat>();
  for (const p of data.players) per.set(p.name, { name: p.name, team: p.team, kills: 0, deaths: 0, caps: 0, streak: 0, best: 0, score: 0 });
  for (const e of data.events) {
    if (e.t > t) break;
    if (e.type === "kill") { const a = e.actor ? per.get(e.actor) : undefined; if (a) { a.kills++; a.streak++; a.best = Math.max(a.best, a.streak); } const v = e.victim ? per.get(e.victim) : undefined; if (v) { v.deaths++; v.streak = 0; } }
    else if (e.type === "capture") { const p = e.pid ? per.get(e.pid) : undefined; if (p) p.caps++; }
  }
  for (const s of per.values()) s.score = s.kills * 50 + s.caps * 75;
  return per;
}

export type BaseState = { owner: string | null; hold: Record<string, number>; burned: boolean; burnTeam: string | null; anim: "none" | "warn" | "crit" | "burned" };
export function baseStateAt(data: RoundData, t: number): Record<number, BaseState> {
  const th = data.burnThresholdSeconds;
  const res: Record<number, BaseState> = {};
  for (const base of data.bases) {
    const burn = data.burns.find((b) => b.baseId === base.id) ?? null;
    const burned = !!burn && t >= burn.t;
    const capT = burned ? burn!.t : t;
    const fs = data.baseFlips.filter((f) => f.baseId === base.id).sort((a, b) => a.t - b.t);
    const hold: Record<string, number> = {};
    for (const tm of data.teams) hold[tm] = 0;
    let owner: string | null = null;
    for (let i = 0; i < fs.length; i++) {
      const cur = fs[i];
      if (cur.t > capT) break;
      owner = cur.team;
      const next = fs[i + 1];
      const segEnd = next ? Math.min(next.t, capT) : capT;
      hold[cur.team] = (hold[cur.team] ?? 0) + Math.max(0, segEnd - cur.t);
    }
    if (burned) { owner = burn!.team; hold[burn!.team] = Math.max(hold[burn!.team] ?? 0, th); }
    const remaining = owner ? Math.max(0, th - (hold[owner] ?? 0)) : Infinity;
    const anim: BaseState["anim"] = burned ? "burned" : owner && remaining <= 60 ? "crit" : owner && remaining <= 120 ? "warn" : "none";
    res[base.id] = { owner, hold, burned, burnTeam: burn?.team ?? null, anim };
  }
  return res;
}

export const STREAK_NAMES: Record<string, string> = { kill_streak_3: "3-Streak", kill_streak_5: "5-Streak", kill_streak_10: "10-Streak", first_blood: "First Blood", captures_3: "3x Cap", captures_5: "5x Cap" };
export function myStreaks(data: RoundData, t: number, me: string) {
  const out: { key: string; t: number }[] = [];
  let run = 0, caps = 0;
  const firstKill = data.events.find((e) => e.type === "kill");
  for (const e of data.events) {
    if (e.t > t) break;
    if (e.type === "kill" && e.actor === me) { run++; if (run === 3) out.push({ key: "kill_streak_3", t: e.t }); if (run === 5) out.push({ key: "kill_streak_5", t: e.t }); if (run === 10) out.push({ key: "kill_streak_10", t: e.t }); }
    if (e.type === "kill" && e.victim === me) run = 0;
    if (e.type === "capture" && e.pid === me) { caps++; if (caps === 3) out.push({ key: "captures_3", t: e.t }); if (caps === 5) out.push({ key: "captures_5", t: e.t }); }
  }
  if (firstKill && firstKill.actor === me && firstKill.t <= t) out.push({ key: "first_blood", t: firstKill.t });
  return out.sort((a, b) => b.t - a.t);
}

/** The match round winner so far (team that has burned >= 2 bases by t). */
export function winnerAt(data: RoundData, t: number): string | null {
  const c: Record<string, number> = {};
  for (const b of data.burns) if (b.t <= t) c[b.team] = (c[b.team] ?? 0) + 1;
  return Object.entries(c).find(([, n]) => n >= 2)?.[0] ?? null;
}

export type PersonalItem = { t: number; kind: "kill" | "death"; other: string; spawn?: boolean; killId: number };
/** The signed-in player's own kills/deaths (most recent first, capped). */
export function personalFeed(data: RoundData, t: number, me: string, cap = 15): PersonalItem[] {
  const items: PersonalItem[] = [];
  data.events.forEach((e, idx) => {
    if (e.t > t || e.type !== "kill") return;
    if (e.actor === me) items.push({ t: e.t, kind: "kill", other: e.victim ?? "", spawn: e.spawn, killId: idx });
    else if (e.victim === me) items.push({ t: e.t, kind: "death", other: e.actor ?? "", killId: idx });
  });
  return items.sort((a, b) => b.t - a.t).slice(0, cap);
}

export type GlobalItem = { t: number; actor: string; victim: string; actorTeam: string | null; victimTeam: string | null; spawn?: boolean };
/** Every kill in the round (most recent first, capped) for the public/global feed. */
export function globalFeed(data: RoundData, t: number, cap = 20): GlobalItem[] {
  const teamOf = new Map(data.players.map((p) => [p.name, p.team]));
  const items: GlobalItem[] = [];
  for (const e of data.events) {
    if (e.t > t) break;
    if (e.type !== "kill" || !e.actor || !e.victim) continue;
    items.push({ t: e.t, actor: e.actor, victim: e.victim, actorTeam: teamOf.get(e.actor) ?? null, victimTeam: teamOf.get(e.victim) ?? null, spawn: e.spawn });
  }
  return items.reverse().slice(0, cap);
}
