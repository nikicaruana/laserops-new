"use client";

/**
 * components/admin/LiveSim.tsx
 * --------------------------------------------------------------------
 * Simulation of the live per-player phone view: replays a real match by its
 * event timestamps (accelerated) and shows what a player would see on their
 * phone as the game unfolds. Prototype for the eventual file-listener + realtime
 * pipeline — pure client, driven by a bundled compact timeline.
 */
import { useEffect, useMemo, useRef, useState } from "react";

type Ev = { t: number; type: "kill" | "capture" | "respawn"; actor?: string; victim?: string; spawn?: boolean; pid?: string; base?: string; team?: string };
export type SimData = { label: string; durationSeconds: number; players: { name: string; team: string }[]; events: Ev[] };

const TEAM_HEX: Record<string, string> = { Blue: "#3b82f6", Yellow: "#eab308", Red: "#ef4444", Green: "#22c55e" };
const teamHex = (c: string) => TEAM_HEX[c] ?? "#8b5cf6";
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

type Stat = { name: string; team: string; kills: number; deaths: number; spawn: number; caps: number; streak: number; best: number; score: number };

function statsAt(data: SimData, t: number): Map<string, Stat> {
  const per = new Map<string, Stat>();
  for (const p of data.players) per.set(p.name, { name: p.name, team: p.team, kills: 0, deaths: 0, spawn: 0, caps: 0, streak: 0, best: 0, score: 0 });
  for (const e of data.events) {
    if (e.t > t) break;
    if (e.type === "kill") {
      const a = e.actor ? per.get(e.actor) : undefined;
      if (a) { a.kills++; if (e.spawn) a.spawn++; a.streak++; a.best = Math.max(a.best, a.streak); }
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

export function LiveSim({ data }: { data: SimData }) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(60);
  const [sel, setSel] = useState(data.players[0]?.name ?? "");
  const raf = useRef<number | null>(null);
  const last = useRef<number>(0);

  useEffect(() => {
    if (!playing) return;
    last.current = performance.now();
    const step = (now: number) => {
      const dt = (now - last.current) / 1000;
      last.current = now;
      setT((prev) => {
        const next = prev + dt * speed;
        if (next >= data.durationSeconds) { setPlaying(false); return data.durationSeconds; }
        return next;
      });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [playing, speed, data.durationSeconds]);

  const stats = useMemo(() => statsAt(data, t), [data, t]);
  const board = useMemo(() => [...stats.values()].sort((a, b) => b.score - a.score), [stats]);
  const me = stats.get(sel);
  const myRank = board.findIndex((s) => s.name === sel) + 1;
  const kd = me ? (me.deaths > 0 ? me.kills / me.deaths : me.kills) : 0;

  const feed = useMemo(() => {
    const out: { t: number; text: string; kind: string }[] = [];
    for (const e of data.events) {
      if (e.t > t) break;
      if (e.type === "kill" && e.actor === sel) out.push({ t: e.t, text: `You eliminated ${e.victim}${e.spawn ? " (spawn)" : ""}`, kind: "good" });
      else if (e.type === "kill" && e.victim === sel) out.push({ t: e.t, text: `You were eliminated by ${e.actor}`, kind: "bad" });
      else if (e.type === "capture" && e.pid === sel) out.push({ t: e.t, text: `You captured ${e.base}`, kind: "obj" });
      else if (e.type === "respawn" && e.pid === sel) out.push({ t: e.t, text: `Respawned`, kind: "neutral" });
    }
    return out.reverse().slice(0, 9);
  }, [data, t, sel]);

  const pct = Math.min(100, (t / data.durationSeconds) * 100);
  const done = t >= data.durationSeconds;

  return (
    <div className="text-text">
      {/* Controls */}
      <div className="mb-5 flex flex-wrap items-center gap-3 border border-border bg-bg-elevated px-4 py-3">
        <button
          type="button"
          onClick={() => { if (done) setT(0); setPlaying((p) => !p); }}
          className="border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-bg"
        >
          {playing ? "Pause" : done ? "Replay" : "Play"}
        </button>
        <button type="button" onClick={() => { setPlaying(false); setT(0); }} className="border border-border-strong px-3 py-2 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-text-muted hover:text-text">Reset</button>
        <div className="flex items-center gap-1">
          {[20, 60, 120].map((sp) => (
            <button key={sp} type="button" onClick={() => setSpeed(sp)} className={`px-2 py-1 text-[0.65rem] font-bold ${speed === sp ? "bg-accent text-bg" : "border border-border text-text-muted"}`}>{sp}×</button>
          ))}
        </div>
        <span className="font-mono text-sm tabular-nums text-text-muted">{mmss(t)} / {mmss(data.durationSeconds)}</span>
        <input type="range" min={0} max={data.durationSeconds} value={t} onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }} className="min-w-[160px] flex-1 accent-accent" />
        <select value={sel} onChange={(e) => setSel(e.target.value)} className="border border-border-strong bg-bg px-2 py-1.5 text-sm text-text">
          {data.players.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Phone view */}
        <div className="mx-auto w-full max-w-[320px]">
          <div className="rounded-[2rem] border-4 border-border-strong bg-black p-3 shadow-xl">
            <div className="rounded-[1.4rem] bg-bg p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-bold">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: teamHex(me?.team ?? "") }} />
                  {sel}
                </span>
                <span className="flex items-center gap-1 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-red-400">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> Live
                </span>
              </div>

              <div className="mt-4 text-center">
                <div className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-text-subtle">Live score</div>
                <div className="text-5xl font-extrabold tabular-nums text-accent">{me?.score.toLocaleString("en-US") ?? 0}</div>
                <div className="mt-1 text-[0.7rem] text-text-muted">Rank #{myRank || "–"} of {data.players.length}</div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[["Kills", me?.kills ?? 0], ["Deaths", me?.deaths ?? 0], ["K/D", kd.toFixed(2)]].map(([k, v]) => (
                  <div key={k as string} className="rounded-md bg-bg-elevated py-2">
                    <div className="text-lg font-bold tabular-nums">{v}</div>
                    <div className="text-[0.55rem] uppercase tracking-[0.1em] text-text-subtle">{k}</div>
                  </div>
                ))}
                {[["Captures", me?.caps ?? 0], ["Streak", me?.streak ?? 0], ["Best", me?.best ?? 0]].map(([k, v]) => (
                  <div key={k as string} className="rounded-md bg-bg-elevated py-2">
                    <div className="text-lg font-bold tabular-nums">{v}</div>
                    <div className="text-[0.55rem] uppercase tracking-[0.1em] text-text-subtle">{k}</div>
                  </div>
                ))}
              </div>

              {(me?.streak ?? 0) >= 3 && (
                <div className="mt-3 rounded-md border border-accent/50 bg-accent/10 py-1.5 text-center text-[0.7rem] font-bold uppercase tracking-[0.12em] text-accent">
                  🔥 {me!.streak}-kill streak
                </div>
              )}

              <div className="mt-4">
                <div className="mb-1 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-text-subtle">Live feed</div>
                <ul className="space-y-1">
                  {feed.length === 0 && <li className="text-xs text-text-subtle">Waiting for the action…</li>}
                  {feed.map((f, i) => (
                    <li key={i} className={`flex justify-between gap-2 text-xs ${f.kind === "good" ? "text-emerald-300" : f.kind === "bad" ? "text-red-400" : f.kind === "obj" ? "text-accent" : "text-text-muted"}`}>
                      <span className="truncate">{f.text}</span>
                      <span className="shrink-0 font-mono text-text-subtle">{mmss(f.t)}</span>
                    </li>
                  ))}
                </ul>
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
              <thead className="bg-bg-elevated text-left text-[0.6rem] uppercase tracking-[0.1em] text-text-subtle">
                <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Player</th><th className="px-3 py-2 text-right">Score</th><th className="px-3 py-2 text-right">K</th><th className="px-3 py-2 text-right">D</th><th className="px-3 py-2 text-right">Caps</th><th className="px-3 py-2 text-right">Streak</th></tr>
              </thead>
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
          <p className="mt-2 text-[0.65rem] text-text-subtle">Simulation only — live score is a simple preview (kills + captures), not the final scoring model. Click a player to focus their phone view.</p>
        </div>
      </div>
    </div>
  );
}
