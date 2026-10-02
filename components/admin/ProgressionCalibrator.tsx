"use client";

/**
 * components/admin/ProgressionCalibrator.tsx
 * --------------------------------------------------------------------
 * Admin tool to model the XP formula + level curve against every real game and
 * publish it. Sliders (with matching number inputs) preview only, client-side
 * using the shared computeMatchXp; "Publish & recompute" writes xp_config +
 * rank_levels and replays the whole playerbase (2FA-gated).
 *
 * Token modeling is a WHAT-IF preview only: the two token sliders assume a
 * fraction of games carry a 2x / 1.5x XP token going forward and blend that
 * into an effective multiplier applied to the preview totals. It does not grant
 * tokens or change stored data — grants are configured per level on the Levels
 * page and spent by players at sign-in.
 */
import { useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { TotpGate } from "@/components/admin/TotpGate";
import { computeMatchXp, parseXpConfig, XP_CONFIG_KEYS, type XpConfig } from "@/lib/scoring/xp";

type CfgRow = { key: string; value: number | null };
type LevelRow = { level: number; rank_name: string | null; score_threshold: number | null };
type AggRow = { account_id: string | null; nickname: string | null; match_id: string; score: number | null; rounds_won: number | null; was_winner: boolean | null; xp_from_accolades: number | null; xp_multiplier: number | null; xp_total: number | null; is_double_xp?: boolean | null };

const TIERS = ["Recruit", "Operative", "Ranger", "Specialist", "Veteran", "Elite", "Commander", "Warlord", "Apex", "Legend"];
const num = (v: number) => Math.round(v).toLocaleString("en-US");
const levelForXp = (xp: number, arr: { level: number; x: number }[]) => { let lv = 1; for (const o of arr) if (xp >= o.x) lv = o.level; return lv; };
const rankOf = (L: number) => TIERS[Math.max(0, Math.min(9, Math.floor((L - 1) / 5)))];

// Slider ranges for each formula constant (min / max / step).
const RANGE: Record<keyof XpConfig, { min: number; max: number; step: number }> = {
  base: { min: 0, max: 3000, step: 50 },
  roundWin: { min: 0, max: 2000, step: 25 },
  matchWin: { min: 0, max: 2000, step: 50 },
  perfPool: { min: 0, max: 8000, step: 100 },
  ratingCap: { min: 1, max: 8, step: 0.1 },
};

// Legacy (pre-v2) level thresholds — the old Ranking_System map. Legacy XP is
// placed on THIS map so "Leg L" is the level each player was under the old system.
const LEGACY_LEVELS: { level: number; x: number }[] = [
  { level: 1, x: 0 },
  { level: 2, x: 1000 },
  { level: 3, x: 3500 },
  { level: 4, x: 7500 },
  { level: 5, x: 12900 },
  { level: 6, x: 19600 },
  { level: 7, x: 27600 },
  { level: 8, x: 36900 },
  { level: 9, x: 47400 },
  { level: 10, x: 59100 },
  { level: 11, x: 72100 },
  { level: 12, x: 86200 },
  { level: 13, x: 101500 },
  { level: 14, x: 118000 },
  { level: 15, x: 135700 },
  { level: 16, x: 154400 },
  { level: 17, x: 174400 },
  { level: 18, x: 195400 },
  { level: 19, x: 217600 },
  { level: 20, x: 240900 },
  { level: 21, x: 265300 },
  { level: 22, x: 290700 },
  { level: 23, x: 317300 },
  { level: 24, x: 345000 },
  { level: 25, x: 373700 },
  { level: 26, x: 403500 },
  { level: 27, x: 434400 },
  { level: 28, x: 466300 },
  { level: 29, x: 499300 },
  { level: 30, x: 533400 },
  { level: 31, x: 568500 },
  { level: 32, x: 604600 },
  { level: 33, x: 641800 },
  { level: 34, x: 680000 },
  { level: 35, x: 719300 },
  { level: 36, x: 759600 },
  { level: 37, x: 800900 },
  { level: 38, x: 843200 },
  { level: 39, x: 886600 },
  { level: 40, x: 930900 },
  { level: 41, x: 976300 },
  { level: 42, x: 1022700 },
  { level: 43, x: 1070100 },
  { level: 44, x: 1118500 },
  { level: 45, x: 1167900 },
  { level: 46, x: 1218300 },
  { level: 47, x: 1269700 },
  { level: 48, x: 1322100 },
  { level: 49, x: 1375500 },
  { level: 50, x: 1429900 },
];

const rangeCls = "w-full cursor-pointer accent-[var(--color-accent)]";
const numCls = "w-24 rounded border border-border-strong bg-bg px-2 py-1 text-right font-mono text-text";

export function ProgressionCalibrator({ config, levels, rows }: { config: CfgRow[]; levels: LevelRow[]; rows: AggRow[] }) {
  const router = useRouter();
  const [cfg, setCfg] = useState<XpConfig>(parseXpConfig(config));
  const [A, setA] = useState(1000);
  const [B, setB] = useState(2.0);
  const [N, setN] = useState(50);
  const [minGames, setMinGames] = useState(3);
  // Token what-if: % of games carrying a 2x / 1.5x token (preview only).
  const [pct2x, setPct2x] = useState(0);
  const [pct15x, setPct15x] = useState(0);
  const [gate, setGate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Effective multiplier blended across the modelled token cadence. A 2x token
  // adds +1.0, a 1.5x token adds +0.5, weighted by the fraction of games.
  const effMult = 1 + pct2x / 100 + 0.5 * (pct15x / 100);
  const modelling = pct2x > 0 || pct15x > 0;

  const dbLevels = useMemo(() => levels.map((l) => ({ level: l.level, x: l.score_threshold ?? 0 })).sort((a, b) => a.level - b.level), [levels]);
  const curve = useMemo(() => Array.from({ length: N }, (_, i) => ({ level: i + 1, x: i === 0 ? 0 : Math.round(A * Math.pow(i, B)), rank: TIERS[Math.min(9, Math.floor(i / 5))] })), [A, B, N]);

  const matchAvg = useMemo(() => {
    const byMatch: Record<string, number[]> = {};
    for (const r of rows) (byMatch[r.match_id] ??= []).push(r.score ?? 0);
    const avg: Record<string, number> = {};
    for (const [m, s] of Object.entries(byMatch)) avg[m] = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;
    return avg;
  }, [rows]);

  const players = useMemo(() => {
    const agg: Record<string, { name: string; g: number; dxp: number; legacyTot: number; oldTot: number; newTot: number }> = {};
    for (const r of rows) {
      const key = r.account_id ?? "hb:" + (r.nickname ?? "?");
      const a = (agg[key] ??= { name: r.nickname ?? "?", g: 0, dxp: 0, legacyTot: 0, oldTot: 0, newTot: 0 });
      a.g++;
      if (r.is_double_xp) a.dxp++;
      a.oldTot += r.xp_total ?? 0;
      // Legacy (pre-v2) XP: raw score IS the performance term (doubled on a
      // match-wide double-XP night), plus the fixed 750/round-win + 500/match-win
      // + accolade XP. Fixed historical reference — never moves with the sliders.
      a.legacyTot += (r.score ?? 0) * (r.is_double_xp ? 2 : 1) + 750 * (r.rounds_won ?? 0) + 500 * (r.was_winner ? 1 : 0) + (r.xp_from_accolades ?? 0);
      const avg = matchAvg[r.match_id] ?? 0;
      const rating = avg > 0 ? (r.score ?? 0) / avg : 0;
      // Preview uses the modelled cadence when set, else each row's real
      // multiplier; a match-wide Double XP night is always at least 2x.
      const mult = Math.max(modelling ? effMult : (r.xp_multiplier ?? 1), r.is_double_xp ? 2 : 1);
      a.newTot += computeMatchXp({ rating, roundsWon: r.rounds_won ?? 0, isWinner: !!r.was_winner, accoladeXp: r.xp_from_accolades ?? 0, multiplier: mult }, cfg).xpTotal;
    }
    const curveXY = curve.map((c) => ({ level: c.level, x: c.x }));
    return Object.values(agg)
      .map((a) => ({ ...a, legacyLvl: levelForXp(a.legacyTot, LEGACY_LEVELS), oldLvl: levelForXp(a.oldTot, dbLevels), newLvl: levelForXp(a.newTot, curveXY) }))
      .sort((x, y) => y.newTot - x.newTot);
  }, [rows, cfg, curve, dbLevels, matchAvg, modelling, effMult]);

  const regulars = players.filter((p) => p.g >= minGames);

  // Games-to-level planner. Player TYPES are derived from the real spread of
  // per-game XP across the 3+ game regulars (percentiles), and each row is how
  // many games that type needs to cross a level threshold. Recomputes with the
  // formula + curve sliders (newTot and the curve both move live).
  const planner = useMemo(() => {
    const rates = players.filter((p) => p.g >= 3).map((p) => (p.g > 0 ? p.newTot / p.g : 0)).filter((r) => r > 0).sort((a, b) => a - b);
    const pct = (q: number) => {
      if (rates.length === 0) return 0;
      const idx = (rates.length - 1) * q, lo = Math.floor(idx), hi = Math.ceil(idx);
      return rates[lo] + (rates[hi] - rates[lo]) * (idx - lo);
    };
    const archetypes = [
      { label: "Elite", sub: "top 10%", rate: pct(0.9) },
      { label: "Strong", sub: "top 25%", rate: pct(0.75) },
      { label: "Average", sub: "median", rate: pct(0.5) },
      { label: "Casual", sub: "bottom 25%", rate: pct(0.25) },
    ];
    const rows = curve.map((c) => ({ level: c.level, rank: c.rank, x: c.x, games: archetypes.map((a) => (a.rate > 0 ? Math.ceil(c.x / a.rate) : 0)) }));
    return { archetypes, rows, count: rates.length };
  }, [players, curve]);

  async function publish() {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const configPayload = { [XP_CONFIG_KEYS.base]: cfg.base, [XP_CONFIG_KEYS.roundWin]: cfg.roundWin, [XP_CONFIG_KEYS.matchWin]: cfg.matchWin, [XP_CONFIG_KEYS.perfPool]: cfg.perfPool, [XP_CONFIG_KEYS.ratingCap]: cfg.ratingCap };
      const levelsPayload = curve.map((c) => ({ level: c.level, rank_name: c.rank, score_threshold: c.x }));
      const res = await fetch("/api/admin/progression", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ config: configPayload, levels: levelsPayload }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; matches?: number; players?: number };
      if (!res.ok || !data.ok) setErr(data.error || "Publish failed.");
      else { setMsg(`Published. Recomputed ${data.players} rows across ${data.matches} matches.`); router.refresh(); }
    } catch (e) { setErr(e instanceof Error ? e.message : "Publish failed."); }
    setBusy(false);
  }

  const setNum = (k: keyof XpConfig) => (e: ChangeEvent<HTMLInputElement>) => setCfg({ ...cfg, [k]: parseFloat(e.target.value) || 0 });
  const field = (label: string, k: keyof XpConfig) => {
    const r = RANGE[k];
    return (
      <div className="space-y-1.5">
        <label className="flex items-center justify-between gap-3 text-sm text-text-muted">
          <span>{label}</span>
          <input type="number" step={r.step} min={r.min} max={r.max} value={cfg[k]} onChange={setNum(k)} className={numCls} />
        </label>
        <input type="range" min={r.min} max={r.max} step={r.step} value={cfg[k]} onChange={setNum(k)} className={rangeCls} aria-label={label} />
      </div>
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <div className="space-y-6">
        <section className="rounded-lg border border-border bg-bg-elevated p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.1em] text-text">XP formula</h2>
          <div className="space-y-4">
            {field("Base (played)", "base")}
            {field("Per round won", "roundWin")}
            {field("Match win bonus", "matchWin")}
            {field("Performance pool", "perfPool")}
            {field("Rating cap", "ratingCap")}
          </div>
          <p className="mt-4 rounded bg-bg px-2 py-2 font-mono text-[0.7rem] leading-relaxed text-text-muted">
            xp = {num(cfg.base)} + {num(cfg.roundWin)}&times;roundsWon + {num(cfg.matchWin)}&times;win + {num(cfg.perfPool)}&times;min(rating,{cfg.ratingCap}) + accolades
          </p>
        </section>

        <section className="rounded-lg border border-border bg-bg-elevated p-4">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-[0.1em] text-text">Level curve</h2>
          <p className="mb-3 font-mono text-[0.7rem] text-text-subtle">minXP(L) = A &times; (L&minus;1)<sup>B</sup></p>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="flex items-center justify-between gap-3 text-sm text-text-muted"><span>A &middot; XP to L2</span><input type="number" step={10} min={100} max={3000} value={A} onChange={(e) => setA(parseFloat(e.target.value) || 0)} className={numCls} /></label>
              <input type="range" min={100} max={3000} step={10} value={A} onChange={(e) => setA(parseFloat(e.target.value) || 0)} className={rangeCls} aria-label="A" />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center justify-between gap-3 text-sm text-text-muted"><span>B &middot; steepness</span><input type="number" step={0.05} min={1.2} max={3} value={B} onChange={(e) => setB(parseFloat(e.target.value) || 1)} className={numCls} /></label>
              <input type="range" min={1.2} max={3} step={0.05} value={B} onChange={(e) => setB(parseFloat(e.target.value) || 1)} className={rangeCls} aria-label="B" />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center justify-between gap-3 text-sm text-text-muted"><span>Max level</span><input type="number" step={1} min={10} max={80} value={N} onChange={(e) => setN(Math.max(2, Math.min(80, parseInt(e.target.value) || 2)))} className={numCls} /></label>
              <input type="range" min={10} max={80} step={1} value={N} onChange={(e) => setN(Math.max(2, Math.min(80, parseInt(e.target.value) || 2)))} className={rangeCls} aria-label="Max level" />
            </div>
          </div>
          <p className="mt-4 rounded bg-bg px-2 py-2 font-mono text-[0.7rem] text-text-muted">
            L5 {num(curve[4]?.x ?? 0)} &middot; L20 {num(curve[19]?.x ?? 0)} &middot; L{N} {num(curve[N - 1]?.x ?? 0)} ({rankOf(N)})
          </p>
        </section>

        <section className="rounded-lg border border-border bg-bg-elevated p-4">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-[0.1em] text-text">Token modeling</h2>
          <p className="mb-3 text-[0.7rem] leading-relaxed text-text-subtle">
            What-if only. Assumes this share of games carries an XP token going forward and blends it into the preview. Doesn&apos;t grant tokens or change stored data.
          </p>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="flex items-center justify-between gap-3 text-sm text-text-muted"><span>Games at 2&times; (%)</span><input type="number" step={5} min={0} max={100} value={pct2x} onChange={(e) => setPct2x(Math.max(0, Math.min(100 - pct15x, parseFloat(e.target.value) || 0)))} className={numCls} /></label>
              <input type="range" min={0} max={100} step={5} value={pct2x} onChange={(e) => setPct2x(Math.max(0, Math.min(100 - pct15x, parseFloat(e.target.value) || 0)))} className={rangeCls} aria-label="Games at 2x" />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center justify-between gap-3 text-sm text-text-muted"><span>Games at 1.5&times; (%)</span><input type="number" step={5} min={0} max={100} value={pct15x} onChange={(e) => setPct15x(Math.max(0, Math.min(100 - pct2x, parseFloat(e.target.value) || 0)))} className={numCls} /></label>
              <input type="range" min={0} max={100} step={5} value={pct15x} onChange={(e) => setPct15x(Math.max(0, Math.min(100 - pct2x, parseFloat(e.target.value) || 0)))} className={rangeCls} aria-label="Games at 1.5x" />
            </div>
          </div>
          <p className="mt-4 rounded bg-bg px-2 py-2 font-mono text-[0.7rem] text-text-muted">
            effective multiplier &times;{effMult.toFixed(2)} {modelling ? "(applied to preview)" : "(off — using recorded multipliers)"}
          </p>
        </section>

        <section className="rounded-lg border border-accent/40 bg-bg-elevated p-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.1em] text-accent">Publish</h2>
          <p className="mb-3 text-xs text-text-muted">Saves this formula + level map and recomputes XP, levels and Elo for every player. Requires 2FA. Token modeling is preview-only and is not saved.</p>
          <button type="button" disabled={busy} onClick={() => setGate(true)} className="w-full rounded border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-bg disabled:opacity-50">
            {busy ? "Recomputing…" : "Publish & recompute everyone"}
          </button>
          {msg && <p className="mt-2 text-xs text-emerald-400">{msg}</p>}
          {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
        </section>
      </div>

      {process.env.NODE_ENV !== "production" && (
      <>
      <div className="rounded-lg border border-border bg-bg-elevated">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-text">
            Old vs new &mdash; {regulars.length} players{modelling && <span className="ml-2 font-mono text-[0.7rem] font-normal text-accent">&times;{effMult.toFixed(2)} tokens</span>}
          </h2>
          <div className="flex overflow-hidden rounded border border-border-strong text-xs">
            {[1, 3, 6].map((g) => (
              <button key={g} type="button" onClick={() => setMinGames(g)} className={`px-3 py-1 font-semibold ${minGames === g ? "bg-accent text-bg" : "text-text-muted"}`}>{g === 1 ? "All" : g + "+"}</button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-left text-[0.65rem] uppercase tracking-[0.1em] text-text-subtle">
              <tr><th className="px-4 py-2">Player</th><th className="px-4 py-2 text-right">G</th><th className="px-4 py-2 text-right" title="Double XP games played (already counted as 2× in New XP)">2&times; G</th><th className="px-4 py-2 text-right" title="Legacy (pre-v2) XP = raw score (×2 on double-XP) + 750/round-win + 500/match-win + accolades. Fixed reference to tune against.">Legacy XP</th><th className="px-4 py-2 text-right" title="Legacy XP placed on the OLD level map (the level each player was under the pre-v2 system).">Leg L</th><th className="px-4 py-2 text-right">New XP</th><th className="px-4 py-2 text-right">New L</th><th className="px-4 py-2">Rank</th><th className="px-4 py-2 text-right" title="New level minus Legacy level: how the new system moves each player vs the old one (0 = level preserved).">&Delta;</th></tr>
            </thead>
            <tbody>
              {regulars.map((p) => {
                const d = p.newLvl - p.legacyLvl;
                return (
                  <tr key={p.name} className="border-t border-border/60">
                    <td className="px-4 py-1.5 font-semibold text-text">{p.name}</td>
                    <td className="px-4 py-1.5 text-right font-mono text-text-muted">{p.g}</td>
                    <td className={`px-4 py-1.5 text-right font-mono ${p.dxp > 0 ? "text-accent" : "text-text-subtle"}`}>{p.dxp || "—"}</td>
                    <td className="px-4 py-1.5 text-right font-mono text-text">{num(p.legacyTot)}</td>
                    <td className="px-4 py-1.5 text-right font-mono text-text-muted">{p.legacyLvl}</td>
                    <td className="px-4 py-1.5 text-right font-mono text-text">{num(p.newTot)}</td>
                    <td className="px-4 py-1.5 text-right font-mono font-semibold text-accent">{p.newLvl}</td>
                    <td className="px-4 py-1.5 text-xs uppercase text-text-muted">{rankOf(p.newLvl)}</td>
                    <td className={`px-4 py-1.5 text-right font-mono font-semibold ${d > 0 ? "text-emerald-400" : d < 0 ? "text-red-400" : "text-text-subtle"}`}>{d > 0 ? "+" + d : d}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <section className="rounded-lg border border-border bg-bg-elevated lg:col-span-2">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-text">Games to reach each level &mdash; by player type</h2>
          <p className="mt-1 max-w-4xl text-xs text-text-muted">
            Player types are the percentiles of real per-game XP across your {planner.count} regulars (3+ games) under the current formula. Each cell is the cumulative games at that pace to cross the level threshold. Recomputes as you tune the formula + curve. Use it to place level rewards.
          </p>
        </div>
        <div className="max-h-[30rem] overflow-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="sticky top-0 z-10 bg-bg-elevated text-left text-[0.65rem] uppercase tracking-[0.1em] text-text-subtle">
              <tr>
                <th className="px-4 py-2">Lvl</th>
                <th className="px-4 py-2">Rank</th>
                <th className="px-4 py-2 text-right">XP needed</th>
                {planner.archetypes.map((a) => (
                  <th key={a.label} className="px-4 py-2 text-right">
                    {a.label}
                    <span className="block font-mono text-[0.6rem] font-normal normal-case text-text-subtle">{num(a.rate)}/g &middot; {a.sub}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {planner.rows.map((r) => (
                <tr key={r.level} className={`border-t border-border/60 ${r.level % 5 === 1 ? "bg-bg/40" : ""}`}>
                  <td className="px-4 py-1.5 font-mono font-semibold text-text">{r.level}</td>
                  <td className="px-4 py-1.5 text-xs uppercase text-text-muted">{r.rank}</td>
                  <td className="px-4 py-1.5 text-right font-mono text-text-subtle">{num(r.x)}</td>
                  {r.games.map((g, i) => (
                    <td key={i} className="px-4 py-1.5 text-right font-mono text-text-muted">{r.level === 1 ? "0" : g.toLocaleString()}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      </>
      )}

      <TotpGate open={gate} action="publish XP changes" onCancel={() => setGate(false)} onVerified={() => { setGate(false); publish(); }} />
    </div>
  );
}
