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
    const agg: Record<string, { name: string; g: number; dxp: number; oldTot: number; newTot: number }> = {};
    for (const r of rows) {
      const key = r.account_id ?? "hb:" + (r.nickname ?? "?");
      const a = (agg[key] ??= { name: r.nickname ?? "?", g: 0, dxp: 0, oldTot: 0, newTot: 0 });
      a.g++;
      if (r.is_double_xp) a.dxp++;
      a.oldTot += r.xp_total ?? 0;
      const avg = matchAvg[r.match_id] ?? 0;
      const rating = avg > 0 ? (r.score ?? 0) / avg : 0;
      // Preview uses the modelled cadence when set, else each row's real
      // multiplier; a match-wide Double XP night is always at least 2x.
      const mult = Math.max(modelling ? effMult : (r.xp_multiplier ?? 1), r.is_double_xp ? 2 : 1);
      a.newTot += computeMatchXp({ rating, roundsWon: r.rounds_won ?? 0, isWinner: !!r.was_winner, accoladeXp: r.xp_from_accolades ?? 0, multiplier: mult }, cfg).xpTotal;
    }
    const curveXY = curve.map((c) => ({ level: c.level, x: c.x }));
    return Object.values(agg)
      .map((a) => ({ ...a, oldLvl: levelForXp(a.oldTot, dbLevels), newLvl: levelForXp(a.newTot, curveXY) }))
      .sort((x, y) => y.newTot - x.newTot);
  }, [rows, cfg, curve, dbLevels, matchAvg, modelling, effMult]);

  const regulars = players.filter((p) => p.g >= minGames);

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
              <tr><th className="px-4 py-2">Player</th><th className="px-4 py-2 text-right">G</th><th className="px-4 py-2 text-right" title="Double XP games played (already counted as 2× in New XP)">2&times; G</th><th className="px-4 py-2 text-right">Old XP</th><th className="px-4 py-2 text-right">Old L</th><th className="px-4 py-2 text-right">New XP</th><th className="px-4 py-2 text-right">New L</th><th className="px-4 py-2">Rank</th><th className="px-4 py-2 text-right">&Delta;</th></tr>
            </thead>
            <tbody>
              {regulars.map((p) => {
                const d = p.newLvl - p.oldLvl;
                return (
                  <tr key={p.name} className="border-t border-border/60">
                    <td className="px-4 py-1.5 font-semibold text-text">{p.name}</td>
                    <td className="px-4 py-1.5 text-right font-mono text-text-muted">{p.g}</td>
                    <td className={`px-4 py-1.5 text-right font-mono ${p.dxp > 0 ? "text-accent" : "text-text-subtle"}`}>{p.dxp || "—"}</td>
                    <td className="px-4 py-1.5 text-right font-mono text-text-muted">{num(p.oldTot)}</td>
                    <td className="px-4 py-1.5 text-right font-mono text-text-muted">{p.oldLvl}</td>
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

      <TotpGate open={gate} action="publish XP changes" onCancel={() => setGate(false)} onVerified={() => { setGate(false); publish(); }} />
    </div>
  );
}
