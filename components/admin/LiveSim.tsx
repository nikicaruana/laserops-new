"use client";

/**
 * components/admin/LiveSim.tsx
 * --------------------------------------------------------------------
 * Simulation of the live per-player phone view across a full match. Replays
 * each round by its event timestamps (accelerated); a round ends when a team
 * burns 2 bases, then the next round auto-starts with a FRESH feed. Round tabs
 * let you jump back to a finished round's end state. Per base: holder + per-team
 * hold timers with warn/critical/burned states (relative to the CURRENT holder).
 * Personal gun kill feed with tap-to-taunt. Prototype for the realtime pipeline.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useWakeLock } from "@/lib/hooks/use-wake-lock";

type Ev = { t: number; type: "kill" | "capture" | "respawn"; actor?: string; victim?: string; spawn?: boolean; pid?: string; base?: string; team?: string };
type SimPlayer = { name: string; team: string; gunName: string; gunImage: string };
type Base = { id: number; name: string };
type RoundData = { round: number; winner: string | null; durationSeconds: number; teams: string[]; players: SimPlayer[]; bases: Base[]; baseFlips: { t: number; baseId: number; team: string }[]; burns: { baseId: number; team: string; t: number }[]; burnThresholdSeconds: number; events: Ev[] };
export type MatchData = { label: string; rounds: RoundData[] };

const BASE_IMAGES: Record<string, string> = {
  blue: "https://res.cloudinary.com/dqud5b7pa/image/upload/v1788695676/Capture-Base-Blue_vgfkcw.png",
  yellow: "https://res.cloudinary.com/dqud5b7pa/image/upload/v1788695676/Capture-Base-Yellow_gs2dzo.png",
  red: "https://res.cloudinary.com/dqud5b7pa/image/upload/v1788695676/Capture-Base-Red_mjgf1b.png",
  neutral: "https://res.cloudinary.com/dqud5b7pa/image/upload/v1788702466/Capture-Base-Grey_ssigi0.png",
};

const TEAM_HEX: Record<string, string> = { Blue: "#3b82f6", Yellow: "#eab308", Red: "#ef4444", Green: "#22c55e" };
const teamHex = (c: string | null) => (c && TEAM_HEX[c]) || "#6b7280";
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const sb = (key: string) => `https://res.cloudinary.com/dqud5b7pa/image/upload/laseropsmalta.com/streak-badges/${key}.png`;

function BaseEmblem({ color, size = 40 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <path d="M50 4 L61 39 L96 50 L61 61 L50 96 L39 61 L4 50 L39 39 Z" fill={color} />
      <circle cx="50" cy="50" r="12" fill="#0b0b0b" /><circle cx="50" cy="50" r="6" fill={color} />
    </svg>
  );
}

function simEndOf(r: RoundData): number {
  const byTeam: Record<string, number[]> = {};
  for (const b of r.burns) (byTeam[b.team] ??= []).push(b.t);
  let end = r.durationSeconds;
  for (const tm in byTeam) { const s = byTeam[tm].sort((a, b) => a - b); if (s.length >= 2) end = Math.min(end, s[1]); }
  return Math.min(r.durationSeconds, end + 3);
}

type Stat = { name: string; team: string; kills: number; deaths: number; caps: number; streak: number; best: number; score: number };
function statsAt(data: RoundData, t: number): Map<string, Stat> {
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

type BaseState = { owner: string | null; hold: Record<string, number>; burned: boolean; burnTeam: string | null; anim: "none" | "warn" | "crit" | "burned" };
function baseStateAt(data: RoundData, t: number): Record<number, BaseState> {
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
    // Pulse is relative to the CURRENT holder's cumulative hold only.
    const remaining = owner ? Math.max(0, th - (hold[owner] ?? 0)) : Infinity;
    const anim: BaseState["anim"] = burned ? "burned" : owner && remaining <= 60 ? "crit" : owner && remaining <= 120 ? "warn" : "none";
    res[base.id] = { owner, hold, burned, burnTeam: burn?.team ?? null, anim };
  }
  return res;
}

const STREAK_NAMES: Record<string, string> = { kill_streak_3: "3-Streak", kill_streak_5: "5-Streak", kill_streak_10: "10-Streak", first_blood: "First Blood", captures_3: "3x Cap", captures_5: "5x Cap" };
function myStreaks(data: RoundData, t: number, me: string) {
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

type Taunt = { round: number; from: string; to: string; at: number };

export function LiveSim({ match }: { match: MatchData }) {
  const [roundIdx, setRoundIdx] = useState(0);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(20);
  const [sel, setSel] = useState(match.rounds[0]?.players[0]?.name ?? "");
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [taunts, setTaunts] = useState<Taunt[]>([]);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [ended, setEnded] = useState(false);
  const [keepAwake, setKeepAwake] = useState(true);
  useWakeLock(keepAwake); // keep the phone screen on while the live view is open
  const raf = useRef<number | null>(null);
  const lastNow = useRef<number>(0);

  const data = match.rounds[roundIdx];
  const simEnd = useMemo(() => simEndOf(data), [data]);
  const gunOf = useMemo(() => new Map(data.players.map((p) => [p.name, p])), [data.players]);

  // Replay clock.
  useEffect(() => {
    if (!playing) return;
    lastNow.current = performance.now();
    const step = (now: number) => { const dt = (now - lastNow.current) / 1000; lastNow.current = now; setT((prev) => Math.min(simEnd, prev + dt * speed)); raf.current = requestAnimationFrame(step); };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [playing, speed, simEnd]);

  // Detect round end.
  useEffect(() => { if (playing && t >= simEnd) { setPlaying(false); setEnded(true); } }, [t, playing, simEnd]);

  // On round end: mark complete, then auto-advance to the next round (fresh feed).
  useEffect(() => {
    if (!ended) return;
    setEnded(false);
    setCompleted((c) => new Set(c).add(roundIdx));
    if (roundIdx + 1 < match.rounds.length) { const to = setTimeout(() => { setRoundIdx((r) => r + 1); setT(0); setPlaying(true); }, 900); return () => clearTimeout(to); }
  }, [ended, roundIdx, match.rounds.length]);

  function goToRound(i: number) { setPlaying(false); setRoundIdx(i); setT(completed.has(i) ? simEndOf(match.rounds[i]) : 0); }

  const stats = useMemo(() => statsAt(data, t), [data, t]);
  const bases = useMemo(() => baseStateAt(data, t), [data, t]);
  const board = useMemo(() => [...stats.values()].sort((a, b) => b.score - a.score), [stats]);
  const me = stats.get(sel);
  const myRank = board.findIndex((s) => s.name === sel) + 1;
  const kd = me ? (me.deaths > 0 ? me.kills / me.deaths : me.kills) : 0;
  const streaks = useMemo(() => myStreaks(data, t, sel), [data, t, sel]);
  const done = t >= simEnd;
  const winner = useMemo(() => { const c: Record<string, number> = {}; for (const b of data.burns) if (b.t <= t) c[b.team] = (c[b.team] ?? 0) + 1; return Object.entries(c).find(([, n]) => n >= 2)?.[0] ?? null; }, [data, t]);

  const feed = useMemo(() => {
    type Item = { t: number; kind: "kill" | "death" | "taunt"; other: string; spawn?: boolean; killId?: number };
    const items: Item[] = [];
    data.events.forEach((e, idx) => { if (e.t > t || e.type !== "kill") return; if (e.actor === sel) items.push({ t: e.t, kind: "kill", other: e.victim ?? "", spawn: e.spawn }); else if (e.victim === sel) items.push({ t: e.t, kind: "death", other: e.actor ?? "", killId: idx }); });
    for (const tw of taunts) if (tw.round === roundIdx && tw.to === sel && tw.at <= t) items.push({ t: tw.at, kind: "taunt", other: tw.from });
    return items.sort((a, b) => b.t - a.t).slice(0, 15); // keep only the 15 most recent
  }, [data, t, sel, taunts, roundIdx]);

  function sendTaunt(to: string, killId: number) { setTaunts((prev) => [...prev, { round: roundIdx, from: sel, to, at: t }]); setSent((prev) => new Set(prev).add(`${roundIdx}:${killId}`)); }

  return (
    <div className="text-text">
      <style>{`
        @keyframes lsSize{0%,100%{transform:scale(1)}50%{transform:scale(1.14)}}
        @keyframes lsGlow{0%,100%{filter:brightness(1)}50%{filter:brightness(1.55)}}
        .ls-scroll{scrollbar-width:thin;scrollbar-color:var(--color-accent-dim) transparent;}
        .ls-scroll::-webkit-scrollbar{width:6px;height:6px;}
        .ls-scroll::-webkit-scrollbar-track{background:transparent;}
        .ls-scroll::-webkit-scrollbar-thumb{background:var(--color-accent-dim);border-radius:9999px;}
        .ls-scroll::-webkit-scrollbar-thumb:hover{background:var(--color-accent);}
      `}</style>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3 border border-border bg-bg-elevated px-4 py-3">
        <button type="button" onClick={() => { if (done) setT(0); setPlaying((p) => !p); }} className="border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-bg">{playing ? "Pause" : done ? "Replay" : "Play"}</button>
        <button type="button" onClick={() => { setPlaying(false); setT(0); }} className="border border-border-strong px-3 py-2 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-text-muted hover:text-text">Reset</button>
        <div className="flex items-center gap-1">{[5, 20, 60, 120].map((sp) => (<button key={sp} type="button" onClick={() => setSpeed(sp)} className={`px-2 py-1 text-[0.65rem] font-bold ${speed === sp ? "bg-accent text-bg" : "border border-border text-text-muted"}`}>{sp}×</button>))}</div>
        <span className="font-mono text-sm tabular-nums text-text-muted">{mmss(t)} / {mmss(simEnd)}</span>
        <input type="range" min={0} max={simEnd} value={t} onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }} className="min-w-[160px] flex-1 accent-accent" />
        <select value={sel} onChange={(e) => setSel(e.target.value)} className="border border-border-strong bg-bg px-2 py-1.5 text-sm text-text">{data.players.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}</select>
      </div>

      {/* Round tabs */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-text-subtle">Rounds:</span>
        {match.rounds.map((r, i) => (
          <button key={r.round} type="button" onClick={() => goToRound(i)} className={`px-3 py-1.5 text-xs font-bold ${i === roundIdx ? "bg-accent text-bg" : completed.has(i) ? "border border-border-strong text-text-muted hover:text-text" : "border border-border text-text-subtle hover:text-text"}`}>
            R{r.round}{completed.has(i) && r.winner ? ` · ${r.winner[0]}` : ""}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Phone view */}
        <div className="mx-auto w-full max-w-[360px]">
          <div className="rounded-[2rem] border-4 border-border-strong bg-black p-3 shadow-xl">
            <div className="flex h-[660px] flex-col gap-2 rounded-[1.4rem] bg-bg p-3">
              <div className="flex shrink-0 items-center justify-between px-1">
                <span className="flex items-center gap-2 text-sm font-bold"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: teamHex(me?.team ?? null) }} />{sel}</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setKeepAwake((k) => !k)} title={keepAwake ? "Screen stays on — tap to allow auto-lock" : "Screen will auto-lock — tap to keep it on"} aria-label="Keep screen on" className={`text-base leading-none ${keepAwake ? "text-accent" : "text-text-subtle"}`}>{keepAwake ? "🔆" : "🌙"}</button>
                  <span className="text-[0.7rem] font-extrabold uppercase tracking-[0.14em] text-text-muted">Round {data.round}<span className="text-text-subtle"> / {match.rounds.length}</span></span>
                </div>
              </div>
              <div className="flex shrink-0 items-center justify-end px-1 -mt-1">
                {winner ? <span className="text-[0.6rem] font-bold uppercase tracking-[0.14em]" style={{ color: teamHex(winner) }}>{winner} wins the round</span> : <span className="flex items-center gap-1 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-red-400"><span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> Live</span>}
              </div>

              {/* Base capture states */}
              <div className="grid shrink-0 grid-cols-3 gap-2">
                {data.bases.map((base) => {
                  const st = bases[base.id];
                  const owner = st?.owner ?? null;
                  const burned = st?.burned;
                  const anim = st?.anim ?? "none";
                  const sizeAnim = anim === "crit" ? "lsSize 0.7s ease-in-out infinite" : anim === "warn" ? "lsSize 1.1s ease-in-out infinite" : undefined;
                  const img = owner ? BASE_IMAGES[owner.toLowerCase()] : BASE_IMAGES["neutral"];
                  return (
                    <div key={base.id} className="rounded-lg p-2 text-center" style={{ borderStyle: burned ? "dotted" : "solid", borderWidth: burned ? 3 : 1, borderColor: burned ? teamHex(st!.burnTeam) : teamHex(owner) + "88", backgroundColor: teamHex(owner) + "14", animation: anim === "crit" ? "lsGlow 0.7s ease-in-out infinite" : undefined }}>
                      <div className="flex justify-center" style={{ animation: sizeAnim }}>{img ? <img src={img} alt={base.name} className="h-10 w-10 object-contain" /> : <BaseEmblem color={teamHex(owner)} />}</div>
                      <div className="mt-1 truncate text-[0.65rem] font-extrabold uppercase tracking-[0.06em]" title={base.name} style={{ color: burned ? teamHex(st!.burnTeam) : undefined }}>{base.name}</div>
                      <div className="mt-1 space-y-0.5">
                        {data.teams.map((tm) => { const held = st?.hold[tm] ?? 0; const isOwner = owner === tm; return (
                          <div key={tm} className={`flex items-center justify-center gap-1 tabular-nums ${isOwner ? "font-extrabold" : "opacity-70"}`} style={{ color: teamHex(tm), fontSize: isOwner ? "0.95rem" : "0.6rem", animation: isOwner ? sizeAnim : undefined }}>
                            <span className="inline-block rounded-full" style={{ width: isOwner ? 7 : 5, height: isOwner ? 7 : 5, backgroundColor: teamHex(tm) }} />{mmss(held)}
                          </div>
                        ); })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Scorecard */}
              <div className="shrink-0 rounded-lg bg-bg-elevated p-3">
                <div className="flex items-end justify-between">
                  <div><div className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-text-subtle">Live score</div><div className="text-3xl font-extrabold leading-none tabular-nums text-accent">{me?.score.toLocaleString("en-US") ?? 0}</div></div>
                  <div className="text-right text-[0.7rem] text-text-muted">Rank #{myRank || "–"} / {data.players.length}</div>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
                  {[["Kills", me?.kills ?? 0], ["Deaths", me?.deaths ?? 0], ["K/D", kd.toFixed(2)], ["Caps", me?.caps ?? 0]].map(([k, v]) => (<div key={k as string} className="rounded-md bg-bg py-1.5"><div className="text-base font-bold tabular-nums">{v}</div><div className="text-[0.5rem] uppercase tracking-[0.08em] text-text-subtle">{k}</div></div>))}
                </div>
              </div>

              {/* Personal kill feed */}
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="mb-1 shrink-0 px-1 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-text-subtle">Your kill feed</div>
                <ul className="ls-scroll min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
                  {feed.length === 0 && <li className="px-1 text-xs text-text-subtle">Nothing involving you yet…</li>}
                  {feed.map((f, i) => {
                    if (f.kind === "taunt") return <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-bg-elevated px-2 py-1 text-xs text-text-muted"><span>🖕 from <span className="font-semibold text-text">{f.other}</span></span><span className="font-mono text-text-subtle">{mmss(f.t)}</span></li>;
                    const other = gunOf.get(f.other);
                    if (f.kind === "kill") return (
                      <li key={i} className="flex items-center gap-1.5 rounded-md bg-emerald-950/30 px-2 py-1 text-xs"><span className="font-semibold text-emerald-300">You</span>{gunOf.get(sel)?.gunImage ? <img src={gunOf.get(sel)!.gunImage} alt="" className="h-3.5 w-auto opacity-90" /> : <span>›</span>}<span className="truncate" style={{ color: teamHex(other?.team ?? null) }}>{f.other}</span>{f.spawn && <span className="ml-auto rounded bg-red-900/60 px-1 text-[0.5rem] font-bold uppercase text-red-300">spawn</span>}</li>
                    );
                    return (
                      <li key={i} className="flex items-center gap-1.5 rounded-md bg-red-950/30 px-2 py-1 text-xs"><span className="truncate font-semibold" style={{ color: teamHex(other?.team ?? null) }}>{f.other}</span>{other?.gunImage ? <img src={other.gunImage} alt="" className="h-3.5 w-auto opacity-90" /> : <span>›</span>}<span className="text-red-300">You</span>{sent.has(`${roundIdx}:${f.killId}`) ? <span className="ml-auto text-text-subtle">🖕 sent</span> : <button type="button" onClick={() => sendTaunt(f.other, f.killId!)} className="ml-auto shrink-0 rounded border border-border-strong px-1.5 py-0.5 text-[0.6rem] hover:border-accent" title={`Send ${f.other} a 🖕`}>🖕</button>}</li>
                    );
                  })}
                </ul>
              </div>

              {/* Streaks */}
              <div className="shrink-0">
                <div className="mb-1 px-1 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-text-subtle">Your streaks</div>
                <div className="ls-scroll flex gap-2 overflow-x-auto pb-1">
                  {streaks.length === 0 && <span className="px-1 text-xs text-text-subtle">None yet — get on a run!</span>}
                  {streaks.map((s, i) => (<div key={i} className="flex shrink-0 flex-col items-center"><img src={sb(s.key)} alt={STREAK_NAMES[s.key] ?? s.key} className="h-11 w-11 object-contain" /><span className="mt-0.5 whitespace-nowrap text-[0.55rem] text-text-muted">{STREAK_NAMES[s.key] ?? s.key}</span></div>))}
                </div>
              </div>
            </div>
          </div>
          <p className="mt-2 text-center text-[0.65rem] text-text-subtle">What {sel} sees on their phone — Round {data.round}.</p>
        </div>

        {/* Live leaderboard */}
        <div>
          <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-text-subtle">Live leaderboard — Round {data.round}</p>
          <div className="overflow-hidden border border-border">
            <table className="w-full text-sm tabular-nums">
              <thead className="bg-bg-elevated text-left text-[0.6rem] uppercase tracking-[0.1em] text-text-subtle"><tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Player</th><th className="px-3 py-2 text-right">Score</th><th className="px-3 py-2 text-right">K</th><th className="px-3 py-2 text-right">D</th><th className="px-3 py-2 text-right">Caps</th><th className="px-3 py-2 text-right">Streak</th></tr></thead>
              <tbody>
                {board.map((s, i) => (
                  <tr key={s.name} onClick={() => setSel(s.name)} className={`cursor-pointer border-t border-border ${s.name === sel ? "bg-accent/10" : "hover:bg-bg-elevated"}`}>
                    <td className="px-3 py-2 text-text-subtle">{i + 1}</td>
                    <td className="px-3 py-2"><span className="flex items-center gap-2"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: teamHex(s.team) }} />{s.name}</span></td>
                    <td className="px-3 py-2 text-right font-bold text-accent">{s.score.toLocaleString("en-US")}</td>
                    <td className="px-3 py-2 text-right">{s.kills}</td><td className="px-3 py-2 text-right">{s.deaths}</td><td className="px-3 py-2 text-right">{s.caps}</td><td className="px-3 py-2 text-right">{s.streak > 0 ? s.streak : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[0.65rem] text-text-subtle">Each round runs until a team burns 2 bases, then the next round auto-starts with a fresh feed. Click a round tab to revisit a finished round&apos;s end state, or a player to focus their phone. Pulsing/burn states track the current holder only.</p>
        </div>
      </div>
    </div>
  );
}
