"use client";

/**
 * components/portal/InMatchScoreboard.tsx
 * --------------------------------------------------------------------
 * In-match round scores. The player-facing scoreboard shown BETWEEN rounds of an
 * online game running without the live feed. Pick a round; the top card shows a
 * player's stats (your own by default, else the round leader) with per-stat rank,
 * avatar + gun, a horizontally-scrollable strip of streak badges, their nemesis
 * and head-to-head kill lists. Tap any table row to load that player's card. The
 * table highlights the leader of each stat. Display only — data is the cached
 * per-round payload from lib/inmatch/scoreboard.ts.
 */
import { useMemo, useState } from "react";
import { cldImage } from "@/lib/cld";
import type { InMatchScoreboard as Scoreboard, InMatchPlayer, InMatchKill } from "@/lib/inmatch/scoreboard";

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
const nk = (s: string) => s.trim().toLowerCase();

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

export function InMatchScoreboard({ scoreboard, me, pastMode = false }: { scoreboard: Scoreboard; me: string | null; pastMode?: boolean }) {
  const { rounds } = scoreboard;
  const [sel, setSel] = useState(Math.max(0, rounds.length - 1));
  const [pickedName, setPickedName] = useState<string | null>(null);

  const round = rounds[Math.min(sel, Math.max(0, rounds.length - 1))];
  const meKey = (me ?? "").trim().toLowerCase();
  const players = round?.players ?? [];

  const selected = useMemo(() => {
    if (pickedName) {
      const hit = players.find((p) => nk(p.name) === nk(pickedName));
      if (hit) return hit;
    }
    if (meKey) {
      const mine = players.find((p) => nk(p.name) === meKey);
      if (mine) return mine;
    }
    return players[0] ?? null;
  }, [pickedName, players, meKey]);

  // Best value per column (leader highlight); deaths -> lowest is best.
  const best = useMemo(() => {
    if (players.length === 0) return null;
    const max = (f: (p: InMatchPlayer) => number) => Math.max(...players.map(f));
    const min = (f: (p: InMatchPlayer) => number) => Math.min(...players.map(f));
    return {
      score: max((p) => p.totalScore),
      frags: max((p) => p.frags),
      deaths: min((p) => p.deaths),
      kd: max((p) => p.kd),
      accuracy: max((p) => p.accuracy),
      damage: max((p) => p.damage),
      captures: max((p) => p.captures),
      hold: max((p) => p.holdSeconds),
    };
  }, [players]);

  if (!round || players.length === 0 || !best) return null;


  const stats = selected
    ? [
        { label: "Score", value: num(selected.totalScore), rank: rankOf(players, selected, (p) => p.totalScore), big: true },
        { label: "Kills", value: num(selected.frags), rank: rankOf(players, selected, (p) => p.frags) },
        { label: "Deaths", value: num(selected.deaths), rank: rankOf(players, selected, (p) => p.deaths, true) },
        { label: "K/D", value: selected.kd.toFixed(2), rank: rankOf(players, selected, (p) => p.kd) },
        { label: "DMG", value: num(selected.damage), rank: rankOf(players, selected, (p) => p.damage) },
        { label: "ACC", value: `${pct(selected.accuracy)}%`, rank: rankOf(players, selected, (p) => p.accuracy) },
        { label: "Obj Caps", value: num(selected.captures), rank: rankOf(players, selected, (p) => p.captures) },
        { label: "Time (s)", value: num(Math.round(selected.holdSeconds)), rank: rankOf(players, selected, (p) => p.holdSeconds) },
      ]
    : [];

  return (
    <section className="border border-border bg-bg-elevated">
      <div aria-hidden className="h-1 bg-accent" />
      <div className="p-4 sm:p-5">
        {/* Header */}
        <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-text">{pastMode ? "Past Rounds" : "In-Match Scores"}</h2>
        <p className="mt-1 text-[0.7rem] text-text-subtle">
          {pastMode
            ? "Scores from completed rounds – the current round is shown live above. Not final until the match is concluded."
            : "Live scores, updated after each round. Not final until every round is parsed and the match is concluded."}
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

        {/* Desktop: table on the left, selected-player detail on the right.
            Mobile: normal stack (card, streaks, table, nemesis, kills). */}
        <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:gap-x-6 lg:gap-y-4">
        {/* Selected player's card */}
        {selected && (
          <div className="border border-accent bg-accent/10 p-4 lg:col-start-2 lg:row-start-1">
            <div className="flex items-center gap-3">
              <span className="relative block h-11 w-11 shrink-0 overflow-hidden rounded-sm border border-accent bg-bg-overlay">
                {selected.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cldImage(selected.avatarUrl, { w: 96 })} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xs font-bold text-text-subtle">
                    {selected.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-accent">
                  {selected.headband ? `Head ${selected.headband}` : "Round stats"}
                </p>
                <p className="flex items-center gap-1.5 truncate text-sm font-bold text-text">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${teamDot(selected.team)}`} />
                  {selected.name}
                </p>
              </div>
              {selected.gunImageUrl ? (
                <span className="flex h-9 w-16 shrink-0 items-center justify-center bg-accent px-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cldImage(selected.gunImageUrl, { w: 200 })} alt={selected.gunLabel} className="h-7 w-full object-contain" />
                </span>
              ) : selected.gunLabel ? (
                <span className="shrink-0 text-[0.65rem] font-semibold text-text-muted">{selected.gunLabel}</span>
              ) : null}
            </div>

            {/* stat grid with per-stat rank */}
            <div className="mt-3 grid grid-cols-4 gap-2">
              {stats.map((s) => (
                <div key={s.label} className="border border-border bg-bg px-1 py-1.5 text-center">
                  <p className="text-[0.5rem] font-semibold uppercase tracking-[0.06em] text-text-muted">{s.label}</p>
                  <p className={`font-mono font-bold tabular-nums text-accent ${s.big ? "text-base" : "text-sm"}`}>{s.value}</p>
                  <p className="text-[0.5rem] font-semibold uppercase tracking-[0.06em] text-text-subtle">#{s.rank}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Streaks – icon-only, horizontally scrollable */}
        {selected && selected.streaks.length > 0 && (
          <div className="mt-4 lg:mt-0 lg:col-start-2 lg:row-start-2">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-text-muted">Streaks</p>
            <div className="mt-2 flex gap-0 overflow-x-auto px-1 pb-1 pt-3">
              {selected.streaks.map((s) => (
                <div key={s.key} className="relative shrink-0 -mx-2 first:ml-0 last:mr-0" title={`${s.name}${s.count > 1 ? ` ×${s.count}` : ""} · +${s.points}`}>
                  {s.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cldImage(s.imageUrl, { w: 260 })} alt={s.name} className="h-[6.2rem] w-[6.2rem] object-contain" />
                  ) : (
                    <span className="flex h-[6.2rem] w-[6.2rem] items-center justify-center border border-accent/40 bg-bg-overlay px-1 text-center text-[0.6rem] font-semibold text-text">
                      {s.name}
                    </span>
                  )}
                  {s.count > 1 && (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-accent px-1 text-[0.6rem] font-bold text-bg">
                      ×{s.count}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Everyone's performance – tap a row to load that player above */}
        <div className="mt-4 overflow-x-auto lg:mt-0 lg:col-start-1 lg:row-start-1 lg:row-span-4 lg:self-start">
          <table className="w-auto border-collapse text-sm lg:w-full">
            <thead>
              <tr className="border-b border-border-strong text-[0.6rem] uppercase tracking-[0.06em] text-text-muted">
                <Th align="right">#</Th>
                <Th align="left">Ops Tag</Th>
                <Th align="right">Score</Th>
                <Th align="right">K</Th>
                <Th align="right">D</Th>
                <Th align="right">K/D</Th>
                <Th align="right">Acc</Th>
                <Th align="right">Dmg</Th>
                <Th align="right">Caps</Th>
                <Th align="right">Time</Th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => {
                const isMe = meKey && nk(p.name) === meKey;
                const isSel = selected && nk(p.name) === nk(selected.name);
                return (
                  <tr
                    key={`${p.name}-${i}`}
                    onClick={() => setPickedName(p.name)}
                    className={`cursor-pointer border-b border-border transition-colors hover:bg-bg-overlay ${
                      isSel ? "bg-accent/10" : isMe ? "bg-accent/5" : ""
                    }`}
                  >
                    <Td align="right" className="font-mono text-text-subtle">{i + 1}</Td>
                    <Td align="left">
                      <span className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${teamDot(p.team)}`} />
                        <span className="whitespace-nowrap font-semibold text-text">{p.name}</span>
                        {isMe && <span className="shrink-0 text-[0.5rem] font-bold uppercase tracking-[0.1em] text-accent">You</span>}
                      </span>
                    </Td>
                    <NumTd value={num(p.totalScore)} best={p.totalScore === best.score} baseClass="font-bold text-accent" />
                    <NumTd value={String(p.frags)} best={p.frags === best.frags} />
                    <NumTd value={String(p.deaths)} best={p.deaths === best.deaths} baseClass="text-text-muted" />
                    <NumTd value={p.kd.toFixed(2)} best={p.kd === best.kd} />
                    <NumTd value={`${pct(p.accuracy)}%`} best={p.accuracy === best.accuracy} baseClass="text-text-muted" />
                    <NumTd value={num(p.damage)} best={p.damage === best.damage} baseClass="text-text-muted" />
                    <NumTd value={String(p.captures)} best={p.captures === best.captures} />
                    <NumTd value={String(Math.round(p.holdSeconds))} best={p.holdSeconds === best.hold} baseClass="text-text-muted" />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Nemesis + head-to-head for the selected player */}
        {selected?.nemesis && (
          <div className="mt-5 border border-border bg-bg-overlay/60 px-4 py-4 lg:mt-0 lg:col-start-2 lg:row-start-3">
            <p className="mb-3 text-center text-[0.65rem] font-bold uppercase tracking-[0.16em] text-text-muted">Round Nemesis</p>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
              <div className="flex items-center gap-3">
                <span className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-sm border border-border-strong bg-bg-overlay">
                  {selected.nemesis.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cldImage(selected.nemesis.avatarUrl, { w: 120 })} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-bold text-text-subtle">
                      {selected.nemesis.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </span>
                <p className="text-lg font-extrabold uppercase tracking-tight text-accent">{selected.nemesis.name}</p>
              </div>
              <div className="flex gap-6 text-center">
                <div>
                  <p className="font-mono text-2xl font-extrabold text-accent">{selected.nemesis.killsFor}</p>
                  <p className="text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-accent">Kills on them</p>
                </div>
                <div>
                  <p className="font-mono text-2xl font-extrabold text-red-400">{selected.nemesis.killsAgainst}</p>
                  <p className="text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-red-400">Killed by them</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {selected && (selected.killed.length > 0 || selected.killedBy.length > 0) && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:mt-0 lg:col-start-2 lg:row-start-4 lg:grid-cols-1">
            <KillList title={`Players ${selected.name} killed`} rows={selected.killed} tone="accent" />
            <KillList title={`Players who killed ${selected.name}`} rows={selected.killedBy} tone="red" />
          </div>
        )}
        </div>
      </div>
    </section>
  );
}

function KillList({ title, rows, tone }: { title: string; rows: InMatchKill[]; tone: "accent" | "red" }) {
  return (
    <div className="border border-border bg-bg-overlay/60 p-4">
      <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-muted">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-text-subtle">{tone === "red" ? "Untouchable this round." : "No kills this round."}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.name} className="flex items-center justify-between text-sm">
              <span className="truncate text-text">{r.name}</span>
              <span className={`font-mono font-bold ${tone === "red" ? "text-red-400" : "text-accent"}`}>{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align: "left" | "right" }) {
  return <th className={`whitespace-nowrap px-1.5 py-2 font-semibold ${align === "left" ? "text-left" : "text-right"}`}>{children}</th>;
}

function Td({ children, align, className = "" }: { children: React.ReactNode; align: "left" | "right"; className?: string }) {
  return <td className={`px-1.5 py-2 ${align === "left" ? "text-left" : "text-right"} ${className}`}>{children}</td>;
}

function NumTd({ value, best, baseClass = "" }: { value: string; best: boolean; baseClass?: string }) {
  return (
    <td className={`px-1.5 py-2 text-right font-mono tabular-nums ${best ? "bg-accent/20 font-bold text-accent" : baseClass}`}>
      {value}
    </td>
  );
}
