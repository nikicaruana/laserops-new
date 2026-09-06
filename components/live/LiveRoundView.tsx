"use client";

/**
 * components/live/LiveRoundView.tsx
 * --------------------------------------------------------------------
 * The on-phone live round view, a pure function of (round, t). Two modes:
 *   - "player": the signed-in player's personalised view — own scorecard, own
 *      kill feed (with tap-to-taunt), and their streaks.
 *   - "public": a spectator view — same bases/timers, a GLOBAL kill feed, and no
 *      streaks.
 * The parent owns the clock `t` (driven from the live snapshot) and passes it in;
 * this component never simulates time itself.
 */
import { useMemo, useState } from "react";
import {
  type RoundData, teamHex, mmss, sb, BASE_IMAGES,
  statsAt, baseStateAt, myStreaks, personalFeed, globalFeed, winnerAt, STREAK_NAMES,
} from "@/lib/live-sim/engine";

function BaseEmblem({ color, size = 40 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <path d="M50 4 L61 39 L96 50 L61 61 L50 96 L39 61 L4 50 L39 39 Z" fill={color} />
      <circle cx="50" cy="50" r="12" fill="#0b0b0b" /><circle cx="50" cy="50" r="6" fill={color} />
    </svg>
  );
}

export function LiveRoundView({
  data, t, mode, me = null, roundLabel, live = true,
}: {
  data: RoundData;
  t: number;
  mode: "player" | "public";
  me?: string | null;
  roundLabel?: string;
  live?: boolean;
}) {
  const [sentTaunts, setSentTaunts] = useState<Set<number>>(new Set());
  const stats = useMemo(() => statsAt(data, t), [data, t]);
  const bases = useMemo(() => baseStateAt(data, t), [data, t]);
  const gunOf = useMemo(() => new Map(data.players.map((p) => [p.name, p])), [data.players]);
  const winner = useMemo(() => winnerAt(data, t), [data, t]);
  const board = useMemo(() => [...stats.values()].sort((a, b) => b.score - a.score), [stats]);

  const mine = me ? stats.get(me) : undefined;
  const myRank = me ? board.findIndex((s) => s.name === me) + 1 : 0;
  const kd = mine ? (mine.deaths > 0 ? mine.kills / mine.deaths : mine.kills) : 0;
  const streaks = useMemo(() => (mode === "player" && me ? myStreaks(data, t, me) : []), [mode, me, data, t]);
  const pFeed = useMemo(() => (mode === "player" && me ? personalFeed(data, t, me) : []), [mode, me, data, t]);
  const gFeed = useMemo(() => (mode === "public" ? globalFeed(data, t) : []), [mode, data, t]);

  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col gap-2 text-text">
      <style>{`
        @keyframes lsSize{0%,100%{transform:scale(1)}50%{transform:scale(1.14)}}
        @keyframes lsGlow{0%,100%{filter:brightness(1)}50%{filter:brightness(1.55)}}
        .ls-scroll{scrollbar-width:thin;scrollbar-color:var(--color-accent-dim) transparent;}
        .ls-scroll::-webkit-scrollbar{width:6px;height:6px;}
        .ls-scroll::-webkit-scrollbar-thumb{background:var(--color-accent-dim);border-radius:9999px;}
      `}</style>

      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-1">
        <span className="text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-text-muted">
          {roundLabel ?? `Round ${data.round}`}
        </span>
        {mode === "player" && me && (
          <span className="flex min-w-0 items-center justify-center gap-1.5 text-sm font-bold">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: teamHex(mine?.team ?? null) }} />
            <span className="truncate">{me}</span>
          </span>
        )}
        {winner ? (
          <span className="text-[0.62rem] font-bold uppercase tracking-[0.14em]" style={{ color: teamHex(winner) }}>{winner} wins</span>
        ) : live ? (
          <span className="flex items-center gap-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-red-400"><span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> Live</span>
        ) : null}
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

      {mode === "player" ? (
        <>
          {/* Personal scorecard */}
          <div className="shrink-0 rounded-lg bg-bg-elevated p-3">
            <div className="flex items-end justify-between">
              <div><div className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-text-subtle">Live score</div><div className="text-3xl font-extrabold leading-none tabular-nums text-accent">{mine?.score.toLocaleString("en-US") ?? 0}</div></div>
              <div className="text-right text-[0.7rem] text-text-muted">Rank #{myRank || "–"} / {data.players.length}</div>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
              {[["Kills", mine?.kills ?? 0], ["Deaths", mine?.deaths ?? 0], ["K/D", kd.toFixed(2)], ["Caps", mine?.caps ?? 0]].map(([k, v]) => (<div key={k as string} className="rounded-md bg-bg py-1.5"><div className="text-base font-bold tabular-nums">{v}</div><div className="text-[0.5rem] uppercase tracking-[0.08em] text-text-subtle">{k}</div></div>))}
            </div>
          </div>

          {/* Personal kill feed */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-1 shrink-0 px-1 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-text-subtle">Your kill feed</div>
            <ul className="ls-scroll min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
              {pFeed.length === 0 && <li className="px-1 text-xs text-text-subtle">Nothing involving you yet…</li>}
              {pFeed.map((f, i) => {
                const other = gunOf.get(f.other);
                if (f.kind === "kill") return (
                  <li key={i} className="flex items-center gap-1.5 rounded-md bg-emerald-950/30 px-2 py-1 text-xs"><span className="font-semibold text-emerald-300">You</span>{gunOf.get(me!)?.gunImage ? <img src={gunOf.get(me!)!.gunImage} alt="" className="h-3.5 w-auto opacity-90" /> : <span>›</span>}<span className="truncate" style={{ color: teamHex(other?.team ?? null) }}>{f.other}</span>{f.spawn && <span className="ml-auto rounded bg-red-900/60 px-1 text-[0.5rem] font-bold uppercase text-red-300">spawn</span>}</li>
                );
                return (
                  <li key={i} className="flex items-center gap-1.5 rounded-md bg-red-950/30 px-2 py-1 text-xs"><span className="truncate font-semibold" style={{ color: teamHex(other?.team ?? null) }}>{f.other}</span>{other?.gunImage ? <img src={other.gunImage} alt="" className="h-3.5 w-auto opacity-90" /> : <span>›</span>}<span className="text-red-300">You</span>{sentTaunts.has(f.killId) ? <span className="ml-auto text-text-subtle">🖕 sent</span> : <button type="button" onClick={() => setSentTaunts((p) => new Set(p).add(f.killId))} className="ml-auto shrink-0 rounded border border-border-strong px-1.5 py-0.5 text-[0.6rem] hover:border-accent" title={`Send ${f.other} a 🖕`}>🖕</button>}</li>
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
        </>
      ) : (
        <>
          {/* Global kill feed */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-1 shrink-0 px-1 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-text-subtle">Kill feed</div>
            <ul className="ls-scroll min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
              {gFeed.length === 0 && <li className="px-1 text-xs text-text-subtle">No kills yet…</li>}
              {gFeed.map((f, i) => {
                const actor = gunOf.get(f.actor);
                return (
                  <li key={i} className="flex items-center gap-1.5 rounded-md bg-bg-elevated px-2 py-1 text-xs">
                    <span className="truncate font-semibold" style={{ color: teamHex(f.actorTeam) }}>{f.actor}</span>
                    {actor?.gunImage ? <img src={actor.gunImage} alt="" className="h-3.5 w-auto opacity-90" /> : <span>›</span>}
                    <span className="truncate" style={{ color: teamHex(f.victimTeam) }}>{f.victim}</span>
                    {f.spawn && <span className="ml-auto rounded bg-red-900/60 px-1 text-[0.5rem] font-bold uppercase text-red-300">spawn</span>}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Compact live leaderboard */}
          <div className="shrink-0">
            <div className="mb-1 px-1 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-text-subtle">Leaderboard</div>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-xs tabular-nums">
                <tbody>
                  {board.slice(0, 6).map((s, i) => (
                    <tr key={s.name} className="border-t border-border first:border-0">
                      <td className="px-2 py-1 text-text-subtle">{i + 1}</td>
                      <td className="px-2 py-1"><span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: teamHex(s.team) }} /><span className="truncate">{s.name}</span></span></td>
                      <td className="px-2 py-1 text-right font-bold text-accent">{s.score.toLocaleString("en-US")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
