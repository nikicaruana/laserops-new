"use client";

/**
 * components/portal/InMatchScoreboard.tsx
 * --------------------------------------------------------------------
 * In-match round scores (Beta). The player-facing scoreboard shown BETWEEN
 * rounds of an online game running without the live feed: pick a round and see
 * your own stat card (with per-stat rank) + streak badges and a table of
 * everyone's performance. Data is the cached per-round payload built
 * server-side (lib/inmatch/scoreboard.ts); this component is display + round
 * navigation only. Marked Beta — not final.
 */
import { useState } from "react";
import { cldImage } from "@/lib/cld";
import type { InMatchScoreboard as Scoreboard, InMatchPlayer } from "@/lib/inmatch/scoreboard";

export type InMatchViewer = { opsTag: string | null; avatarUrl: string | null; gunLabel: string | null; gunImageUrl: string | null };

const TEAM_DOT: Record<string, string> = {
  yellow: "bg-accent",
  blue: "bg-blue-500",
  red: "bg-red-500",
  green: "bg-green-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  white: "bg-zinc-200",
};
const teamDot = (c: string) => TEAM_DOT[c.toLowerCase()] ?? "bg-zinc-500";

const pct = (a: number) => Math.round(a <= 1 ? a * 100 : a);
const num = (n: number) => n.toLocaleString("en-US");
const ord = (n: number) => `#${n}`;

/** Rank of `mine` among players for a metric (1 = best). */
function rankOf(players: InMatchPlayer[], mine: InMatchPlayer, val: (p: InMatchPlayer) => number, lowerBetter = false) {
  const v = val(mine);
  let rank = 1;
  for (const p of players) {
    if (p === mine) continue;
    const o = val(p);
    if (lowerBetter ? o < v : o > v) rank += 1;
  }
  return rank;
}

export function InMatchScoreboard({ scoreboard, viewer }: { scoreboard: Scoreboard; viewer: InMatchViewer }) {
  const { rounds } = scoreboard;
  const [sel, setSel] = useState(Math.max(0, rounds.length - 1));

  if (rounds.length === 0) return null;
  const round = rounds[Math.min(sel, rounds.length - 1)];
  const meKey = (viewer.opsTag ?? "").trim().toLowerCase();
  const mine = meKey ? round.players.find((p) => p.name.trim().toLowerCase() === meKey) ?? null : null;
  const players = round.players;

  const myStats = mine
    ? [
        { label: "Score", value: num(mine.totalScore), rank: rankOf(players, mine, (p) => p.totalScore), big: true },
        { label: "Kills", value: num(mine.frags), rank: rankOf(players, mine, (p) => p.frags) },
        { label: "Deaths", value: num(mine.deaths), rank: rankOf(players, mine, (p) => p.deaths, true) },
        { label: "K/D", value: mine.kd.toFixed(2), rank: rankOf(players, mine, (p) => p.kd) },
        { label: "Damage", value: num(mine.damage), rank: rankOf(players, mine, (p) => p.damage) },
        { label: "Accuracy", value: `${pct(mine.accuracy)}%`, rank: rankOf(players, mine, (p) => p.accuracy) },
        { label: "Obj Caps", value: num(mine.captures), rank: rankOf(players, mine, (p) => p.captures) },
        { label: "Cap Time (s)", value: num(Math.round(mine.holdSeconds)), rank: rankOf(players, mine, (p) => p.holdSeconds) },
      ]
    : [];

  return (
    <section className="border border-border bg-bg-elevated">
      <div aria-hidden className="h-1 bg-accent" />
      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-text">In-Match Scores</h2>
          <span className="inline-flex items-center rounded-sm bg-accent px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.12em] text-bg">
            Beta
          </span>
        </div>
        <p className="mt-1 text-[0.7rem] text-text-subtle">
          Live between-round scores. Not final &ndash; figures may change once the match is published.
        </p>

        {/* Round tabs */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {rounds.map((r, i) => (
            <button
              key={r.roundNo}
              type="button"
              onClick={() => setSel(i)}
              className={`shrink-0 border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] transition-colors ${
                i === sel
                  ? "border-accent bg-accent text-bg"
                  : "border-border-strong bg-bg-overlay text-text-muted hover:border-accent hover:text-accent"
              }`}
            >
              Round {r.roundNo}
            </button>
          ))}
        </div>

        {/* Round summary */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {round.winnerTeam ? (
            <span className="inline-flex items-center gap-2 border border-border-strong bg-bg-overlay px-2.5 py-1 font-semibold text-text">
              <span className={`h-2 w-2 rounded-full ${teamDot(round.winnerTeam)}`} />
              {round.winnerTeam} won this round
            </span>
          ) : (
            <span className="border border-border-strong bg-bg-overlay px-2.5 py-1 text-text-muted">Round in progress</span>
          )}
          {round.durationSeconds != null && (
            <span className="text-text-subtle">
              {Math.floor(round.durationSeconds / 60)}m {round.durationSeconds % 60}s
            </span>
          )}
        </div>

        {/* Your card */}
        {mine && (
          <div className="mt-4 border border-accent bg-accent/10 p-4">
            {/* identity row */}
            <div className="flex items-center gap-3">
              <span className="relative block h-11 w-11 shrink-0 overflow-hidden rounded-sm border border-border bg-bg-overlay">
                {viewer.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cldImage(viewer.avatarUrl, { w: 96 })} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xs font-bold text-text-subtle">
                    {(viewer.opsTag ?? "?").slice(0, 2).toUpperCase()}
                  </span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-accent">Your round</p>
                <p className="truncate text-sm font-bold text-text">{viewer.opsTag ?? mine.name}</p>
              </div>
              {viewer.gunImageUrl ? (
                <span className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cldImage(viewer.gunImageUrl, { w: 160 })} alt="" className="h-8 w-16 object-contain" />
                </span>
              ) : viewer.gunLabel ? (
                <span className="text-[0.65rem] font-semibold text-text-muted">{viewer.gunLabel}</span>
              ) : null}
            </div>

            {/* stat grid with per-stat rank */}
            <div className="mt-3 grid grid-cols-4 gap-2">
              {myStats.map((s) => (
                <div key={s.label} className="border border-border bg-bg px-1 py-1.5 text-center">
                  <p className="text-[0.5rem] font-semibold uppercase tracking-[0.08em] text-text-muted">{s.label}</p>
                  <p className={`font-mono font-bold tabular-nums text-accent ${s.big ? "text-base" : "text-sm"}`}>{s.value}</p>
                  <p className="text-[0.5rem] font-semibold uppercase tracking-[0.06em] text-text-subtle">{ord(s.rank)}</p>
                </div>
              ))}
            </div>

            {/* streaks as badges */}
            {mine.streaks.length > 0 && (
              <div className="mt-3">
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-text-muted">Streaks</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {mine.streaks.map((s) => (
                    <span
                      key={s.key}
                      className="inline-flex items-center gap-1.5 border border-accent/40 bg-bg-overlay px-1.5 py-1"
                      title={`${s.name}${s.count > 1 ? ` ×${s.count}` : ""} · +${s.points}`}
                    >
                      {s.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cldImage(s.imageUrl, { w: 72 })} alt="" className="h-7 w-7 object-contain" />
                      ) : (
                        <span className="text-[0.65rem] font-semibold text-text">{s.name}</span>
                      )}
                      <span className="flex flex-col leading-tight">
                        <span className="text-[0.6rem] font-semibold text-text">{s.name}</span>
                        <span className="font-mono text-[0.6rem] text-accent">
                          {s.count > 1 ? `×${s.count} · ` : ""}+{s.points}
                        </span>
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Everyone's performance */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border-strong text-[0.6rem] uppercase tracking-[0.08em] text-text-muted">
                <Th className="text-left">#</Th>
                <Th className="text-left">Player</Th>
                <Th>Score</Th>
                <Th>K</Th>
                <Th>D</Th>
                <Th>K/D</Th>
                <Th>Acc</Th>
                <Th>Dmg</Th>
                <Th>Caps</Th>
                <Th>Cap(s)</Th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => {
                const isMe = meKey && p.name.trim().toLowerCase() === meKey;
                return (
                  <tr key={`${p.name}-${i}`} className={`border-b border-border ${isMe ? "bg-accent/5" : ""}`}>
                    <Td className="text-left font-mono text-text-subtle">{i + 1}</Td>
                    <Td className="text-left">
                      <span className="flex items-center gap-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${teamDot(p.team)}`} />
                        <span className="truncate font-semibold text-text">{p.name}</span>
                        {isMe && <span className="text-[0.55rem] font-bold uppercase tracking-[0.12em] text-accent">You</span>}
                      </span>
                    </Td>
                    <Td className="font-mono font-bold tabular-nums text-accent">{num(p.totalScore)}</Td>
                    <Td className="font-mono tabular-nums">{p.frags}</Td>
                    <Td className="font-mono tabular-nums text-text-muted">{p.deaths}</Td>
                    <Td className="font-mono tabular-nums">{p.kd.toFixed(2)}</Td>
                    <Td className="font-mono tabular-nums text-text-muted">{pct(p.accuracy)}%</Td>
                    <Td className="font-mono tabular-nums text-text-muted">{num(p.damage)}</Td>
                    <Td className="font-mono tabular-nums">{p.captures}</Td>
                    <Td className="font-mono tabular-nums text-text-muted">{Math.round(p.holdSeconds)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-2 py-2 font-semibold ${className || "text-right"}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-2 py-2 ${className || "text-right"}`}>{children}</td>;
}
