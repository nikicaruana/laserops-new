"use client";

/**
 * components/admin/LiveSim.tsx
 * --------------------------------------------------------------------
 * Simulation of the live per-player phone view. Replays a real round by its
 * event timestamps (accelerated) and shows the domination state — each base's
 * holder + per-team hold timers — plus the player's scorecard, a gun kill feed,
 * and their streaks. Prototype for the eventual file-listener + realtime pipeline.
 */
import { useEffect, useMemo, useRef, useState } from "react";

type Ev = { t: number; type: "kill" | "capture" | "respawn"; actor?: string; victim?: string; spawn?: boolean; pid?: string; base?: string; team?: string };
type SimPlayer = { name: string; team: string; gunName: string; gunImage: string };
export type SimData = { label: string; durationSeconds: number; teams: string[]; players: SimPlayer[]; bases: string[]; baseFlips: { t: number; base: string; team: string }[]; events: Ev[] };

const TEAM_HEX: Record<string, string> = { Blue: "#3b82f6", Yellow: "#eab308", Red: "#ef4444", Green: "#22c55e" };
const teamHex = (c: string | null) => (c && TEAM_HEX[c]) || "#6b7280";
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const sb = (key: string) => `https://res.cloudinary.com/dqud5b7pa/image/upload/laseropsmalta.com/streak-badges/${key}.png`;

/** Tintable capture-point emblem (placeholder for the team-coloured base art). */
function BaseEmblem({ color, size = 46 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <path d="M50 4 L61 39 L96 50 L61 61 L50 96 L39 61 L4 50 L39 39 Z" fill={color} />
      <circle cx="50" cy="50" r="12" fill="#0b0b0b" />
      <circle cx="50" cy="50" r="6" fill={color} />
    </svg>
  );
}

type Stat = { name: string; team: string; kills: number; deaths: number; caps: number; streak: number; best: number; score: number };
function statsAt(data: SimData, t: number): Map<string, Stat> {
  const per = new Map<string, Stat>();
  for (const p of data.players) per.set(p.name, { name: p.name, team: p.team, kills: 0, deaths: 0, caps: 0, streak: 0, best: 0, score: 0 });
  for (const e of data.events) {
    if (e.t > t) break;
    if (e.type === "kill") {
      const a = e.actor ? per.get(e.actor) : undefined;
      if (a) { a.kills++; a.streak++; a.best = Math.max(a.best, a.streak); }
      const v = e.victim ? per.get(e.victim) : undefined;
      if (v) { v.deaths++; v.streak = 0; }
    } else if (e.type === "capture") {
      const p = e.pid ? per.get(e.pid) : undefined;
      if (p) p.caps++;
    }
  }
  for (const s of per.values()) s.score = s.kills * 50 + s.caps * 75;
  return per;
}

function baseStateAt(data: SimData, t: number) {
  const res: Record<string, { owner: string | null; hold: Record<string, number> }> = {};
  for (const bn of data.bases) {
    const fs = data.baseFlips.filter((f) => f.base === bn).sort((a, b) => a.t - b.t);
    const hold: Record<string, number> = {};
    for (const tm of data.teams) hold[tm] = 0;
    let owner: string | null = null;
    for (let i = 0; i < fs.length; i++) {
      const cur = fs[i];
      if (cur.t > t) break;
      owner = cur.team;
      const next = fs[i + 1];
      const segEnd = next ? Math.min(next.t, t) : t;
      hold[cur.team] = (hold[cur.team] ?? 0) + Math.max(0, segEnd - cur.t);
    }
    res[bn] = { owner, hold };
  }
  return res;
}

const STREAK_NAMES: Record<string, string> = { kill_streak_3: "3-Streak", kill_streak_5: "5-Streak", kill_streak_10: "10-Streak", first_blood: "First Blood", captures_3: "3x Cap", captures_5: "5x Cap" };
function myStreaks(data: SimData, t: number, me: string) {
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

export function LiveSim({ data }: { data: SimData }) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(60);
  const [sel, setSel] = useState(data.players[0]?.name ?? "");
  const raf = useRef<number | null>(null);
  const last = useRef<number>(0);
  const gunOf = useMemo(() => new Map(data.players.map((p) => [p.name, p])), [data.players]);

  useEffect(() => {
    if (!playing) return;
    last.current = performance.now();
    const step = (now: number) => {
      const dt = (now - last.current) / 1000; last.current = now;
      setT((prev) => { const next = prev + dt * speed; if (next >= data.durationSeconds) { setPlaying(false); return data.durationSeconds; } return next; });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [playing, speed, data.durationSeconds]);

  const stats = useMemo(() => statsAt(data, t), [data, t]);
  const bases = useMemo(() => baseStateAt(data, t), [data, t]);
  const board = useMemo(() => [...stats.values()].sort((a, b) => b.score - a.score), [stats]);
  const me = stats.get(sel);
  const myRank = board.findIndex((s) => s.name === sel) + 1;
  const kd = me ? (me.deaths > 0 ? me.kills / me.deaths : me.kills) : 0;
  const streaks = useMemo(() => myStreaks(data, t, sel), [data, t, sel]);
  const feed = useMemo(() => data.events.filter((e) => e.t <= t && e.type === "kill").slice(-12).reverse(), [data, t]);
  const done = t >= data.durationSeconds;

  return (
    <div className="text-text">
      {/* Controls */}
      <div className="mb-5 flex flex-wrap items-center gap-3 border border-border bg-bg-elevated px-4 py-3">
        <button type="button" onClick={() => { if (done) setT(0); setPlaying((p) => !p); }} className="border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-bg">{playing ? "Pause" : done ? "Replay" : "Play"}</button>
        <button type="button" onClick={() => { setPlaying(false); setT(0); }} className="border border-border-strong px-3 py-2 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-text-muted hover:text-text">Reset</button>
        <div className="flex items-center gap-1">{[20, 60, 120].map((sp) => (<button key={sp} type="button" onClick={() => setSpeed(sp)} className={`px-2 py-1 text-[0.65rem] font-bold ${speed === sp ? "bg-accent text-bg" : "border border-border text-text-muted"}`}>{sp}×</button>))}</div>
        <span className="font-mono text-sm tabular-nums text-text-muted">{mmss(t)} / {mmss(data.durationSeconds)}</span>
        <input type="range" min={0} max={data.durationSeconds} value={t} onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }} className="min-w-[160px] flex-1 accent-accent" />
        <select value={sel} onChange={(e) => setSel(e.target.value)} className="border border-border-strong bg-bg px-2 py-1.5 text-sm text-text">{data.players.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}</select>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Phone view */}
        <div className="mx-auto w-full max-w-[360px]">
          <div className="rounded-[2rem] border-4 border-border-strong bg-black p-3 shadow-xl">
            <div className="rounded-[1.4rem] bg-bg p-3">
              <div className="flex items-center justify-between px-1">
                <span className="flex items-center gap-2 text-sm font-bold"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: teamHex(me?.team ?? null) }} />{sel}</span>
                <span className="flex items-center gap-1 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-red-400"><span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> Live</span>
              </div>

              {/* Base capture states */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                {data.bases.map((bn) => {
                  const st = bases[bn];
                  const owner = st?.owner ?? null;
                  return (
                    <div key={bn} className="rounded-lg border p-2 text-center" style={{ borderColor: teamHex(owner) + "88", backgroundColor: teamHex(owner) + "14" }}>
                      <div className="flex justify-center"><BaseEmblem color={teamHex(owner)} /></div>
                      <div className="mt-1 text-[0.7rem] font-bold uppercase tracking-[0.08em]">{bn}</div>
                      <div className="mt-1 space-y-0.5">
                        {data.teams.map((tm) => {
                          const held = st?.hold[tm] ?? 0;
                          const isOwner = owner === tm;
                          return (
                            <div key={tm} className={`flex items-center justify-center gap-1 tabular-nums ${isOwner ? "font-extrabold" : "opacity-70"}`} style={{ color: teamHex(tm), fontSize: isOwner ? "0.95rem" : "0.6rem" }}>
                              <span className="inline-block rounded-full" style={{ width: isOwner ? 7 : 5, height: isOwner ? 7 : 5, backgroundColor: teamHex(tm) }} />
                              {mmss(held)}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Scorecard */}
              <div className="mt-3 rounded-lg bg-bg-elevated p-3">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-text-subtle">Live score</div>
                    <div className="text-3xl font-extrabold leading-none tabular-nums text-accent">{me?.score.toLocaleString("en-US") ?? 0}</div>
                  </div>
                  <div className="text-right text-[0.7rem] text-text-muted">Rank #{myRank || "–"} / {data.players.length}</div>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
                  {[["Kills", me?.kills ?? 0], ["Deaths", me?.deaths ?? 0], ["K/D", kd.toFixed(2)], ["Caps", me?.caps ?? 0]].map(([k, v]) => (
                    <div key={k as string} className="rounded-md bg-bg py-1.5"><div className="text-base font-bold tabular-nums">{v}</div><div className="text-[0.5rem] uppercase tracking-[0.08em] text-text-subtle">{k}</div></div>
                  ))}
                </div>
              </div>

              {/* Kill feed */}
              <div className="mt-3">
                <div className="mb-1 px-1 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-text-subtle">Kill feed</div>
                <ul className="space-y-1">
                  {feed.length === 0 && <li className="px-1 text-xs text-text-subtle">Waiting for the action…</li>}
                  {feed.map((e, i) => {
                    const killer = gunOf.get(e.actor ?? "");
                    return (
                      <li key={i} className="flex items-center gap-1.5 rounded-md bg-bg-elevated px-2 py-1 text-xs">
                        <span className="truncate font-semibold" style={{ color: teamHex(killer?.team ?? null) }}>{e.actor}</span>
                        {killer?.gunImage ? <img src={killer.gunImage} alt="" className="h-3.5 w-auto shrink-0 opacity-90" /> : <span className="text-text-subtle">›</span>}
                        <span className="truncate" style={{ color: teamHex(gunOf.get(e.victim ?? "")?.team ?? null) }}>{e.victim}</span>
                        {e.spawn && <span className="ml-auto shrink-0 rounded bg-red-900/60 px-1 text-[0.5rem] font-bold uppercase text-red-300">spawn</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Streaks (horizontal scroll) */}
              <div className="mt-3">
                <div className="mb-1 px-1 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-text-subtle">Your streaks</div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {streaks.length === 0 && <span className="px-1 text-xs text-text-subtle">None yet — get on a run!</span>}
                  {streaks.map((s, i) => (
                    <div key={i} className="flex shrink-0 flex-col items-center">
                      <img src={sb(s.key)} alt={STREAK_NAMES[s.key] ?? s.key} className="h-12 w-12 object-contain" />
                      <span className="mt-0.5 whitespace-nowrap text-[0.55rem] text-text-muted">{STREAK_NAMES[s.key] ?? s.key}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <p className="mt-2 text-center text-[0.65rem] text-text-subtle">What {sel} sees on their phone, live.</p>
        </div>

        {/* Live leaderboard */}
        <div>
          <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-text-subtle">Live leaderboard</p>
          <div className="overflow-hidden border border-border">
            <table className="w-full text-sm tabular-nums">
              <thead className="bg-bg-elevated text-left text-[0.6rem] uppercase tracking-[0.1em] text-text-subtle"><tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Player</th><th className="px-3 py-2 text-right">Score</th><th className="px-3 py-2 text-right">K</th><th className="px-3 py-2 text-right">D</th><th className="px-3 py-2 text-right">Caps</th><th className="px-3 py-2 text-right">Streak</th></tr></thead>
              <tbody>
                {board.map((s, i) => (
                  <tr key={s.name} onClick={() => setSel(s.name)} className={`cursor-pointer border-t border-border ${s.name === sel ? "bg-accent/10" : "hover:bg-bg-elevated"}`}>
                    <td className="px-3 py-2 text-text-subtle">{i + 1}</td>
                    <td className="px-3 py-2"><span className="flex items-center gap-2"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: teamHex(s.team) }} />{s.name}</span></td>
                    <td className="px-3 py-2 text-right font-bold text-accent">{s.score.toLocaleString("en-US")}</td>
                    <td className="px-3 py-2 text-right">{s.kills}</td>
                    <td className="px-3 py-2 text-right">{s.deaths}</td>
                    <td className="px-3 py-2 text-right">{s.caps}</td>
                    <td className="px-3 py-2 text-right">{s.streak > 0 ? s.streak : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[0.65rem] text-text-subtle">Simulation only — live score is a simple preview (kills + captures). Base emblems are tinted placeholders; drop your PNGs at <span className="font-mono">/images/bases/</span> (or send Cloudinary URLs) to use the real art. Click a player to focus their phone.</p>
        </div>
      </div>
    </div>
  );
}
