"use client";

/**
 * app/scoring-lab/page.tsx  (localhost experiment — not linked in nav, dev only)
 * --------------------------------------------------------------------
 * Scores several real games' objective data (baked in aggregates.json) under
 * several capture/hold weightings so you can see how the standings shift. Pick a
 * game from the dropdown; Kill Score + streaks are identical across scenarios for
 * that game, only the objective weights change.
 * Objective = caps*capW + recaps*recapW + hold*holdW. Total = Kill + Streak + Objective.
 */
import { useMemo, useState } from "react";
import data from "./aggregates.json";

type Player = {
  name: string; team: string; kills: number; deaths: number;
  damage: number; caps: number; recaps: number; hold: number; killScore: number; streakScore: number;
};
type Game = {
  matchId: string; matchLabel: string; matchDate: string;
  minHold: number; recapWindow: number; spawnWindow?: number; players: Player[];
};
type Scenario = { id: string; label: string; holdW: number; capW: number; recapW: number; fixed: boolean };

const GAMES = data.games as Game[];

const PRESETS: Scenario[] = [
  { id: "1", label: "Current", holdW: 2, capW: 75, recapW: 50, fixed: true },
  { id: "2", label: "Hold 1.5", holdW: 1.5, capW: 75, recapW: 50, fixed: true },
  { id: "3", label: "Hold 1", holdW: 1, capW: 75, recapW: 50, fixed: true },
  { id: "4", label: "Cap 100", holdW: 1, capW: 100, recapW: 75, fixed: true },
  { id: "5", label: "Cap 150", holdW: 1, capW: 150, recapW: 100, fixed: true },
];

const teamDot = (team: string) =>
  team.toLowerCase() === "yellow" ? "#EF9F27" : team.toLowerCase() === "blue" ? "#378ADD" : "#888780";

function objScore(p: Player, s: { holdW: number; capW: number; recapW: number }) {
  return p.caps * s.capW + p.recaps * s.recapW + p.hold * s.holdW;
}

export default function ScoringLabPage() {
  const [gameId, setGameId] = useState(GAMES[0]?.matchId ?? "");
  const [custom, setCustom] = useState({ holdW: 1, capW: 90, recapW: 60 });
  const [sortId, setSortId] = useState("1");

  const game = useMemo(() => GAMES.find((g) => g.matchId === gameId) ?? GAMES[0], [gameId]);
  const PLAYERS = game.players;
  const TOTAL_RECAPS = useMemo(() => PLAYERS.reduce((s, p) => s + p.recaps, 0), [PLAYERS]);

  const scenarios: Scenario[] = useMemo(
    () => [...PRESETS, { id: "custom", label: "Custom", ...custom, fixed: false }],
    [custom],
  );

  // scenarioId -> playerName -> { total, obj, rank }
  const table = useMemo(() => {
    const m: Record<string, Record<string, { total: number; obj: number; rank: number }>> = {};
    for (const s of scenarios) {
      const rows = PLAYERS.map((p) => {
        const obj = objScore(p, s);
        return { name: p.name, obj, total: p.killScore + p.streakScore + obj };
      }).sort((a, b) => b.total - a.total);
      m[s.id] = {};
      rows.forEach((r, i) => (m[s.id][r.name] = { total: r.total, obj: r.obj, rank: i + 1 }));
    }
    return m;
  }, [scenarios, PLAYERS]);

  const ordered = useMemo(
    () => [...PLAYERS].sort((a, b) => table[sortId][a.name].rank - table[sortId][b.name].rank),
    [table, sortId, PLAYERS],
  );

  const th = "px-3 py-2 text-left text-[0.65rem] font-bold uppercase tracking-[0.08em] text-text-muted whitespace-nowrap";
  const td = "px-3 py-2 text-sm text-text whitespace-nowrap tabular-nums";

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8">
      <header className="mb-6 border-b border-border pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Scoring lab</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">{game.matchLabel}</h1>
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <span className="uppercase tracking-[0.1em]">Game</span>
            <select
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              className="border border-border-strong bg-bg px-2 py-1 text-sm font-semibold text-text"
            >
              {GAMES.map((g) => (
                <option key={g.matchId} value={g.matchId}>{g.matchId} ({g.players.length}p)</option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-text-muted">
          Real objective data ({game.matchDate}), scored through the live engine, five ways. Kill Score and
          streak points are identical everywhere; only the objective weights change. <span className="text-text">Objective</span> = caps&times;capW +
          recaps&times;recapW + hold&times;holdW. <span className="text-text">Total</span> = Kill + Streak + Objective. Scenario 1 reproduces the published report exactly.
          Exploit rules: a capture counts only if held &ge; {game.minHold}s; a same-player retake within{" "}
          {game.recapWindow}s is a recapture{game.spawnWindow ? `; spawn-protection window ${game.spawnWindow}s` : ""}.
        </p>
        {TOTAL_RECAPS <= 3 && (
          <p className="mt-2 max-w-3xl border-l-2 border-amber-500 pl-3 text-xs text-amber-200/90">
            Heads up: this match has only <span className="font-semibold">{TOTAL_RECAPS} recapture{TOTAL_RECAPS === 1 ? "" : "s"}</span> across all players, so
            scenarios 4 and 5 differ from 3 almost entirely through the higher <span className="font-semibold">capture</span>{" "}
            value, not the recapture value.
          </p>
        )}
      </header>

      {/* Scenario legend */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {scenarios.map((s) => (
          <div
            key={s.id}
            className={`border px-3 py-2 ${s.id === sortId ? "border-accent bg-bg-elevated" : "border-border bg-bg-elevated/50"}`}
          >
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.06em] text-text">
              {s.fixed ? `S${s.id}` : "★"} {s.label}
            </p>
            <p className="mt-0.5 text-[0.65rem] text-text-muted tabular-nums">
              hold&times;{s.holdW} · cap {s.capW} · recap {s.recapW}
            </p>
          </div>
        ))}
      </div>

      {/* Custom weights */}
      <div className="mb-5 flex flex-wrap items-center gap-4 portal-card px-4 py-3">
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-accent">★ Custom</span>
        {([
          ["Hold /s", "holdW", 0, 3, 0.25],
          ["Capture", "capW", 0, 200, 5],
          ["Recapture", "recapW", 0, 150, 5],
        ] as const).map(([label, key, min, max, step]) => (
          <label key={key} className="flex items-center gap-2 text-xs text-text-muted">
            {label}
            <input
              type="range" min={min} max={max} step={step}
              value={custom[key]}
              onChange={(e) => setCustom((c) => ({ ...c, [key]: Number(e.target.value) }))}
              className="w-28"
            />
            <span className="w-9 text-right font-semibold tabular-nums text-text">{custom[key]}</span>
          </label>
        ))}
      </div>

      <div className="mb-2 flex items-center gap-2 text-xs text-text-muted">
        <span>Sort by</span>
        <select
          value={sortId}
          onChange={(e) => setSortId(e.target.value)}
          className="border border-border-strong bg-bg px-2 py-1 text-xs text-text"
        >
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>{s.fixed ? `S${s.id} — ${s.label}` : "★ Custom"}</option>
          ))}
        </select>
        <span className="ml-2">Cell tint = rank vs S1 (green better, red worse). Bold = #1.</span>
      </div>

      <div className="overflow-x-auto border border-border">
        <table className="w-full border-collapse">
          <thead className="border-b border-border portal-surface">
            <tr>
              <th className={th}>#</th>
              <th className={th}>Player</th>
              <th className={`${th} text-right`}>K</th>
              <th className={`${th} text-right`}>D</th>
              <th className={`${th} text-right`}>Caps</th>
              <th className={`${th} text-right`}>Rc</th>
              <th className={`${th} text-right`}>Hold</th>
              <th className={`${th} text-right`}>Kill</th>
              <th className={`${th} text-right`}>Strk</th>
              {scenarios.map((s) => (
                <th key={s.id} className={`${th} text-right ${s.id === sortId ? "text-accent" : ""}`}>
                  {s.fixed ? `S${s.id}` : "★"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordered.map((p) => {
              const baseRank = table["1"][p.name].rank;
              return (
                <tr key={p.name} className="border-b border-border/60 last:border-0">
                  <td className={`${td} text-text-muted`}>{table[sortId][p.name].rank}</td>
                  <td className={td}>
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: teamDot(p.team) }} />
                      {p.name}
                    </span>
                  </td>
                  <td className={`${td} text-right`}>{p.kills}</td>
                  <td className={`${td} text-right`}>{p.deaths}</td>
                  <td className={`${td} text-right`}>{p.caps}</td>
                  <td className={`${td} text-right text-text-muted`}>{p.recaps}</td>
                  <td className={`${td} text-right`}>{p.hold}s</td>
                  <td className={`${td} text-right text-text-muted`}>{p.killScore.toLocaleString()}</td>
                  <td className={`${td} text-right text-text-subtle`}>{p.streakScore.toLocaleString()}</td>
                  {scenarios.map((s) => {
                    const cell = table[s.id][p.name];
                    const delta = baseRank - cell.rank; // >0 = moved up vs S1
                    const tint =
                      s.id === "1" || delta === 0 ? "" : delta > 0 ? "bg-emerald-950/40 text-emerald-300" : "bg-red-950/30 text-red-300";
                    return (
                      <td key={s.id} className={`${td} text-right ${tint} ${cell.rank === 1 ? "font-bold text-text" : ""}`}>
                        {Math.round(cell.total).toLocaleString()}
                        <span className="ml-1 text-[0.65rem] text-text-muted">#{cell.rank}</span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-text-subtle">
        {game.matchId} · min-hold {game.minHold}s · recap window {game.recapWindow}s{game.spawnWindow ? ` · spawn window ${game.spawnWindow}s` : ""} · Localhost only.
      </p>
    </div>
  );
}
