"use client";

/**
 * components/portal/InMatchScoreboard.tsx
 * --------------------------------------------------------------------
 * In-match round scores (Beta). The player-facing scoreboard shown BETWEEN
 * rounds of an online game running without the live feed: pick a round and see
 * your own stat card + streaks and a table of everyone's performance. Data is
 * the cached per-round payload built server-side (lib/inmatch/scoreboard.ts);
 * this component is display + round navigation only. Marked Beta — not final.
 */
import { useState } from "react";
import type { InMatchScoreboard as Scoreboard, InMatchPlayer } from "@/lib/inmatch/scoreboard";

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

const pct = (a: number) => Math.round((a <= 1 ? a * 100 : a));
const num = (n: number) => n.toLocaleString("en-US");

export function InMatchScoreboard({ scoreboard, me }: { scoreboard: Scoreboard; me: string | null }) {
  const { rounds } = scoreboard;
  const [sel, setSel] = useState(Math.max(0, rounds.length - 1));

  if (rounds.length === 0) return null;
  const round = rounds[Math.min(sel, rounds.length - 1)];
  const meKey = (me ?? "").trim().toLowerCase();
  const mine = meKey ? round.players.find((p) => p.name.trim().toLowerCase() === meKey) ?? null : null;
  const myRank = mine ? round.players.indexOf(mine) + 1 : null;

  return (
    <section className="border border-border bg-bg-elevated">
      <div aria-hidden className="h-1 bg-accent" />
      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-text">In-Match Scores</h2>
              <span className="inline-flex items-center rounded-sm bg-accent px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.12em] text-bg">
                Beta
              </span>
            </div>
            <p className="mt-1 text-[0.7rem] text-text-subtle">
              Live between-round scores. Not final &ndash; figures may change once the match is published.
            </p>
          </div>
        </div>

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
            <div className="flex items-center justify-between">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-accent">Your round</p>
              {myRank && (
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-text-muted">
                  Rank <span className="font-mono text-accent">#{myRank}</span> of {round.players.length}
                </p>
              )}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              <MyStat label="Score" value={num(mine.totalScore)} big />
              <MyStat label="Kills" value={num(mine.frags)} />
              <MyStat label="Deaths" value={num(mine.deaths)} />
              <MyStat label="K/D" value={mine.kd.toFixed(2)} />
              <MyStat label="Damage" value={num(mine.damage)} />
              <MyStat label="Accuracy" value={`${pct(mine.accuracy)}%`} />
            </div>
            {mine.streaks.length > 0 && (
              <div className="mt-3">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-text-muted">Streaks</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {mine.streaks.map((s) => (
                    <span
                      key={s.key}
                      className="inline-flex items-center gap-1.5 border border-accent/50 bg-bg-overlay px-2 py-1 text-[0.65rem] font-semibold text-text"
                    >
                      {s.name}
                      {s.count > 1 && <span className="text-text-subtle">×{s.count}</span>}
                      <span className="font-mono text-accent">+{s.points}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Everyone's performance */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border-strong text-[0.6rem] uppercase tracking-[0.1em] text-text-muted">
                <Th className="text-left">#</Th>
                <Th className="text-left">Player</Th>
                <Th>K</Th>
                <Th>D</Th>
                <Th>K/D</Th>
                <Th>Dmg</Th>
                <Th>Streaks</Th>
                <Th>Score</Th>
              </tr>
            </thead>
            <tbody>
              {round.players.map((p, i) => {
                const isMe = meKey && p.name.trim().toLowerCase() === meKey;
                return (
                  <tr
                    key={`${p.name}-${i}`}
                    className={`border-b border-border ${isMe ? "bg-accent/5" : ""}`}
                  >
                    <Td className="text-left font-mono text-text-subtle">{i + 1}</Td>
                    <Td className="text-left">
                      <span className="flex items-center gap-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${teamDot(p.team)}`} />
                        <span className="truncate font-semibold text-text">{p.name}</span>
                        {isMe && (
                          <span className="text-[0.55rem] font-bold uppercase tracking-[0.12em] text-accent">You</span>
                        )}
                      </span>
                    </Td>
                    <Td className="font-mono tabular-nums">{p.frags}</Td>
                    <Td className="font-mono tabular-nums text-text-muted">{p.deaths}</Td>
                    <Td className="font-mono tabular-nums">{p.kd.toFixed(2)}</Td>
                    <Td className="font-mono tabular-nums text-text-muted">{num(p.damage)}</Td>
                    <Td className="font-mono tabular-nums text-text-subtle">{streakBadge(p)}</Td>
                    <Td className="font-mono font-bold tabular-nums text-accent">{num(p.totalScore)}</Td>
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

function streakBadge(p: InMatchPlayer) {
  if (p.streaks.length === 0) return "–";
  const total = p.streaks.reduce((n, s) => n + s.count, 0);
  return total;
}

function MyStat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="border border-border bg-bg text-center">
      <p className="pt-1.5 text-[0.55rem] font-semibold uppercase tracking-[0.1em] text-text-muted">{label}</p>
      <p className={`pb-1.5 font-mono font-bold tabular-nums text-accent ${big ? "text-lg" : "text-base"}`}>{value}</p>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-2 py-2 font-semibold ${className || "text-right"}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-2 py-2 ${className || "text-right"}`}>{children}</td>;
}
