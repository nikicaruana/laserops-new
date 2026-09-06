"use client";

/**
 * components/admin/IngestPanel.tsx
 * --------------------------------------------------------------------
 * Admin ingest PREVIEW + STAGING. Drop one or more round JSON files; each is
 * parsed in the browser, then SAVED to match_ingest_rounds (raw file + parsed
 * jsonb) so it survives a refresh. Renders the persisted rounds as extracted
 * facts. Nothing is written to player stats/XP/ELO yet – committing those is a
 * separate, later step gated on real-file validation.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseRound, type Round } from "@/lib/ingestion/round-parser";
import { laserOpsScores } from "@/lib/ingestion/score";
import { evaluateStreaks, type StreakDef } from "@/lib/ingestion/streak-engine";
import { effectiveWithResolutions, unreviewedCount, type RoundResolutions } from "@/lib/ingestion/resolutions";
import type { ScoreFormula } from "@/lib/scoring/formula";
import { createClient } from "@/lib/supabase/client";

const OPERATOR_ID = "00000000-0000-0000-0000-000000000001";

export type SavedRound = { id: string; filename: string | null; parsed: Round; resolutions: RoundResolutions };

const th = "px-2 py-2 text-left text-[0.55rem] font-semibold uppercase tracking-[0.1em] text-text-muted";
const td = "px-2 py-1.5 text-sm";

const fmtHold = (s: number): string => {
  if (!s) return "–";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
};

export function IngestPanel({
  matchId,
  rounds,
  headbandLabels = {},
  formula,
  voidSpawn,
  streakDefs,
  tradeMinHoldSeconds,
  spawnWindowSeconds,
  recaptureWindowSeconds,
  recapturePoints,
}: {
  matchId: string;
  rounds: SavedRound[];
  headbandLabels?: Record<number, string>;
  formula: ScoreFormula;
  voidSpawn: boolean;
  streakDefs: StreakDef[];
  tradeMinHoldSeconds?: number | null;
  /** Spawn-protection window from Exploit Control (spawn_camp_config). */
  spawnWindowSeconds?: number;
  /** Base-trading recapture window + points from Exploit Control (base_trading_config). */
  recaptureWindowSeconds?: number | null;
  recapturePoints?: number | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, RoundResolutions>>(
    () => Object.fromEntries(rounds.map((r) => [r.id, r.resolutions ?? {}])),
  );

  async function saveResolutions(roundId: string, next: RoundResolutions) {
    setResolutions((prev) => ({ ...prev, [roundId]: next }));
    const supabase = createClient();
    const { error: err } = await supabase.from("match_ingest_rounds").update({ resolutions: next }).eq("id", roundId);
    if (err) setError(`Couldn't save resolution: ${err.message}`);
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    for (const f of picked) {
      try {
        const text = await f.text();
        const parsed = parseRound(text, { spawnWindowSeconds });
        const { error: err } = await supabase.from("match_ingest_rounds").insert({
          operator_id: OPERATOR_ID,
          match_id: matchId,
          filename: f.name,
          raw_file: text,
          parsed,
        });
        if (err) {
          setError(`${f.name}: ${err.message}`);
          break;
        }
      } catch (err) {
        setError(`${f.name}: ${err instanceof Error ? err.message : "Couldn't parse"}`);
        break;
      }
    }
    setBusy(false);
    e.target.value = "";
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this ingested round?")) return;
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.from("match_ingest_rounds").delete().eq("id", id);
    setBusy(false);
    if (err) return setError(err.message);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 border border-border bg-bg-elevated px-4 py-4">
        <label className="inline-flex cursor-pointer items-center gap-2 border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-bg">
          {busy ? "Saving…" : "Choose round file(s)"}
          <input type="file" accept=".json,application/json" multiple onChange={onPick} className="hidden" disabled={busy} />
        </label>
        <p className="text-[0.7rem] text-text-subtle">
          One JSON file per round. Parsed and saved to this match. Preview only, no stats written yet.
        </p>
      </div>

      {error && (
        <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      {rounds.length === 0 && (
        <p className="border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">
          No round files ingested yet.
        </p>
      )}

      {rounds.map((sr, i) => (
        <RoundPreview
          key={sr.id}
          name={sr.filename ?? `round ${i + 1}`}
          round={sr.parsed}
          index={i + 1}
          headbandLabels={headbandLabels}
          formula={formula}
          voidSpawn={voidSpawn}
          streakDefs={streakDefs}
          tradeMinHoldSeconds={tradeMinHoldSeconds}
          recaptureWindowSeconds={recaptureWindowSeconds}
          recapturePoints={recapturePoints}
          resolutions={resolutions[sr.id] ?? {}}
          onChangeResolutions={(next) => saveResolutions(sr.id, next)}
          onRemove={() => remove(sr.id)}
        />
      ))}
    </div>
  );
}

function RoundPreview({
  name,
  round: r,
  index,
  headbandLabels,
  formula,
  voidSpawn,
  streakDefs,
  tradeMinHoldSeconds,
  recaptureWindowSeconds,
  recapturePoints,
  resolutions,
  onChangeResolutions,
  onRemove,
}: {
  name: string;
  round: Round;
  index: number;
  headbandLabels: Record<number, string>;
  formula: ScoreFormula;
  voidSpawn: boolean;
  streakDefs: StreakDef[];
  tradeMinHoldSeconds?: number | null;
  recaptureWindowSeconds?: number | null;
  recapturePoints?: number | null;
  resolutions: RoundResolutions;
  onChangeResolutions: (next: RoundResolutions) => void;
  onRemove: () => void;
}) {
  // Apply admin resolutions (ambiguous same-second captures) before scoring:
  // reassignments + optional even hold split, reflected in scores/hold/streaks.
  const { round: rr, eff } = effectiveWithResolutions(
    r,
    { minHoldSeconds: tradeMinHoldSeconds, recaptureWindowSeconds },
    resolutions,
  );
  const scores = laserOpsScores(
    rr,
    formula,
    voidSpawn,
    { minHoldSeconds: tradeMinHoldSeconds, recaptureWindowSeconds, recapturePoints },
    eff,
  );
  const tradesConfigured = !!tradeMinHoldSeconds && tradeMinHoldSeconds > 0;
  const ambiguities = r.ambiguous_captures ?? [];
  const unreviewed = unreviewedCount(r, resolutions);
  const [open, setOpen] = useState(true);
  const [csvResult, setCsvResult] = useState<null | { checked: number; issues: { player: string; field: string; json: number; csv: number }[] }>(null);

  // Cross-check the JSON parse against the round's CSV export (counters must match).
  async function handleCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const h = lines[0].split(",");
    const col = (n: string) => h.indexOf(n);
    const ni = col("PlayerNickName");
    const fields: [string, string, string][] = [
      ["Frags", "PlayerFragsCount", "frags"], ["Deaths", "PlayerDeathsCount", "deaths"],
      ["Hits", "PlayerHitsCount", "hits"], ["Shots", "PlayerShotsCount", "shots"],
      ["Wounds", "PlayerWoundsCount", "wounds"], ["Caps", "PlayerDeviceCapturingsCount", "captures"],
      ["Revivals", "PlayerRevivalsCount", "revivals"],
    ];
    const issues: { player: string; field: string; json: number; csv: number }[] = [];
    let checked = 0;
    for (const line of lines.slice(1)) {
      const cols = line.split(",");
      const nick = (cols[ni] ?? "").trim();
      const pl = r.players.find((p) => p.name === nick);
      if (!pl) continue;
      const c = r.final_player_counters?.[pl.in_game_player_id];
      if (!c) continue;
      checked++;
      for (const [label, csvCol, jsonKey] of fields) {
        const csvVal = parseInt(cols[col(csvCol)] ?? "") || 0;
        const jsonVal = (c as Record<string, number>)[jsonKey] ?? 0;
        if (csvVal !== jsonVal) issues.push({ player: nick, field: label, json: jsonVal, csv: csvVal });
      }
    }
    setCsvResult({ checked, issues });
    e.target.value = "";
  }
  // Streaks grouped by player, with a per-player count of each streak type.
  const streaks = evaluateStreaks(rr, streakDefs);
  const streaksByPlayer = new Map<number, Map<string, number>>();
  for (const s of streaks) {
    if (!streaksByPlayer.has(s.player_id)) streaksByPlayer.set(s.player_id, new Map());
    const m = streaksByPlayer.get(s.player_id)!;
    m.set(s.name, (m.get(s.name) ?? 0) + 1);
  }
  const playerLabel = (pid: number): string => {
    const p = r.players.find((x) => x.in_game_player_id === pid);
    return (p?.headband_no != null && headbandLabels[p.headband_no]) || p?.name || `#${pid}`;
  };
  const kills = r.events.kills.length;
  // A "hit" = a shot that dealt damage. Tags that applied 0 HP (i-frames / spawn
  // or start protection) are registered by the hardware but aren't real hits.
  const effectiveHits = r.events.damage.filter((d) => d.damage > 0).length;
  const blockedHits = r.events.damage.length - effectiveHits;
  const captures = r.events.captures.length;
  const spawnKills = r.ingestion_flags.find((f) => f.code === "spawn_kills")?.detail ?? "0";
  const durationMin = r.meta.duration_seconds != null ? Math.round(r.meta.duration_seconds / 60) : "–";

  const facts: [string, string][] = [
    ["Round", `#${index}`],
    ["Mode", r.scenario.inferred_mode],
    ["Players", String(r.meta.player_count)],
    ["Teams", r.teams.map((t) => t.colour).join(" / ")],
    ["Bases", String(r.bases.length)],
    ["Duration", `${durationMin} min`],
    ["Kills", String(kills)],
    ["Hits", blockedHits > 0 ? `${effectiveHits} · ${blockedHits} no-dmg` : String(effectiveHits)],
    ["Captures", String(captures)],
    ["Spawn kills", spawnKills],
  ];

  return (
    <div className="border border-border bg-bg-elevated">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 font-mono text-xs text-text-muted hover:text-text" aria-expanded={open}>
          <span className="inline-block w-3 text-text-subtle">{open ? "▾" : "▸"}</span>
          {name}
        </button>
        <div className="flex items-center gap-3">
          {unreviewed > 0 && (
            <span className="rounded-sm bg-red-600 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-white">
              ⚠ {unreviewed} to review
            </span>
          )}
          {r.ingestion_flags.length > 0 && (
            <span className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-amber-300">
              {r.ingestion_flags.length} flag{r.ingestion_flags.length === 1 ? "" : "s"}
            </span>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-text-subtle hover:text-red-400"
          >
            Remove
          </button>
        </div>
      </div>

      {ambiguities.length > 0 && (
        <div className="border-b border-border bg-red-950/30 px-4 py-3">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-red-300">
            ⚠ Same-second capture ambiguity — review before final scoring
          </p>
          <p className="mt-1 text-[0.7rem] text-text-muted">
            Two or more players on the same team captured different bases in the same second, so the data can&apos;t prove who captured which base — capture time may be credited to the wrong player. Assign each base (shown by name) to the correct player, or split the capture time evenly between them, then mark it reviewed.
          </p>
          <div className="mt-3 space-y-3">
            {ambiguities.map((g) => {
              const def: Record<string, number> = {};
              for (const b of g.base_ids) {
                const cap = r.events.captures.find((c) => c.base_id === b && c.time === g.time);
                if (cap?.capturing_player_id != null) def[String(b)] = cap.capturing_player_id;
              }
              const cur = resolutions[g.id]?.assign ?? def;
              const reviewed = resolutions[g.id]?.reviewed ?? false;
              const split = resolutions[g.id]?.split ?? false;
              const update = (assign: Record<string, number>, rev: boolean, sp: boolean) =>
                onChangeResolutions({ ...resolutions, [g.id]: { assign, reviewed: rev, split: sp } });
              const totalHold = g.holds.reduce((s, h) => s + h.held_seconds, 0);
              return (
                <div key={g.id} className={`border px-3 py-2 ${reviewed ? "border-emerald-700/60 bg-emerald-950/20" : "border-red-700/60"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[0.7rem] text-text-muted">{g.time} · {g.team} team</span>
                    <span className={`text-[0.6rem] font-bold uppercase tracking-[0.1em] ${reviewed ? "text-emerald-300" : "text-red-300"}`}>{reviewed ? "✓ Reviewed" : "Unreviewed"}</span>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {g.holds.map((h) => (
                      <div key={h.base_id} className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-text-muted">
                          <span className="font-semibold text-text">{h.nickname || `Base #${h.base_id}`}</span>
                          {h.nickname ? <span className="text-text-subtle"> (#{h.base_id})</span> : null}
                          <span className="text-text-subtle"> · {fmtHold(h.held_seconds)} held</span> · captured by
                        </span>
                        <select
                          value={String(cur[String(h.base_id)] ?? "")}
                          onChange={(e) => update({ ...cur, [String(h.base_id)]: Number(e.target.value) }, reviewed, split)}
                          className="border border-border-strong bg-bg px-2 py-1 text-xs text-text"
                        >
                          {g.player_ids.map((pid) => (
                            <option key={pid} value={String(pid)}>{playerLabel(pid)}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-xs text-text-muted">
                    <input type="checkbox" checked={split} onChange={(e) => update(cur, reviewed, e.target.checked)} className="accent-accent" />
                    Split capture time evenly between {g.player_ids.map((p) => playerLabel(p)).join(" & ")}
                    {split ? <span className="text-text-subtle">({fmtHold(Math.floor(totalHold / g.player_ids.length))} each)</span> : null}
                  </label>
                  <div className="mt-2 flex gap-2">
                    {!reviewed ? (
                      <button type="button" onClick={() => update(cur, true, split)} className="border border-accent bg-accent px-3 py-1 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-bg">Mark reviewed</button>
                    ) : (
                      <button type="button" onClick={() => update(cur, false, split)} className="border border-border px-3 py-1 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-text-subtle hover:text-text">Reopen</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {open && (<>
      <div className="grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-5">
        {facts.map(([k, v]) => (
          <div key={k} className="bg-bg-elevated px-3 py-2">
            <p className="text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-text-subtle">{k}</p>
            <p className="mt-0.5 text-sm font-semibold text-text">{v}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead className="border-b border-border">
            <tr>
              <th className={th}>Headband</th>
              <th className={th}>Player</th>
              <th className={th}>Team</th>
              <th className={`${th} text-right`} title={`LaserOps score from your scoring formula${voidSpawn ? " (spawn kills/damage voided)" : ""}`}>
                LaserOps
              </th>
              <th className={`${th} text-right`}>K</th>
              <th className={`${th} text-right`}>D</th>
              <th className={`${th} text-right`}>Dmg</th>
              <th className={`${th} text-right`}>Caps</th>
              <th
                className={`${th} text-right`}
                title={tradesConfigured ? `Captures held < ${tradeMinHoldSeconds}s (not counted; burn-exempt) - from Exploit Control` : "Set a min hold-to-count in Exploit Control"}
              >
                Uncounted
              </th>
              <th className={`${th} text-right`}>Cap time</th>
              <th className={`${th} text-right`} title="Kills within 3s of the victim's respawn">Sp.K</th>
              <th className={`${th} text-right`} title="Damage dealt in spawn windows (voidable amount)">Sp.Dmg</th>
            </tr>
          </thead>
          <tbody>
            {r.players.map((p) => {
              const c = r.final_player_counters?.[p.in_game_player_id];
              const label = (p.headband_no != null && headbandLabels[p.headband_no]) || p.name;
              return (
                <tr key={p.in_game_player_id} className="border-b border-border/60 last:border-0">
                  <td className={`${td} font-mono font-semibold text-accent`}>{p.headband_no ?? "–"}</td>
                  <td className={`${td} text-text`}>{label}</td>
                  <td className={`${td} text-text-muted`}>{p.team}</td>
                  <td className={`${td} text-right font-mono tabular-nums font-semibold text-accent`}>{scores[p.in_game_player_id] ?? 0}</td>
                  <td className={`${td} text-right font-mono tabular-nums text-text-muted`}>{c?.frags ?? 0}</td>
                  <td className={`${td} text-right font-mono tabular-nums text-text-muted`}>{c?.deaths ?? 0}</td>
                  <td className={`${td} text-right font-mono tabular-nums text-text-muted`}>{r.damage_dealt?.[p.in_game_player_id] ?? 0}</td>
                  <td className={`${td} text-right font-mono tabular-nums text-text-muted`}>
                    {(eff.captures[p.in_game_player_id] ?? 0) + (eff.recaptures[p.in_game_player_id] ?? 0)}
                    {(eff.recaptures[p.in_game_player_id] ?? 0) > 0 ? <span className="text-text-subtle"> ({eff.recaptures[p.in_game_player_id]}rc)</span> : null}
                  </td>
                  <td className={`${td} text-right font-mono tabular-nums ${!tradesConfigured ? "text-text-subtle" : (eff.excludedCaptures[p.in_game_player_id] ?? 0) > 0 ? "text-amber-300" : "text-text-subtle"}`}>
                    {tradesConfigured ? (eff.excludedCaptures[p.in_game_player_id] ?? 0) : "–"}
                  </td>
                  <td className={`${td} text-right font-mono tabular-nums text-text-muted`}>{fmtHold(eff.holdSeconds[p.in_game_player_id] ?? 0)}</td>
                  <td className={`${td} text-right font-mono tabular-nums ${(r.spawn_kills_by?.[p.in_game_player_id] ?? 0) > 0 ? "text-amber-300" : "text-text-subtle"}`}>{r.spawn_kills_by?.[p.in_game_player_id] ?? 0}</td>
                  <td className={`${td} text-right font-mono tabular-nums ${(r.spawn_damage_by?.[p.in_game_player_id] ?? 0) > 0 ? "text-amber-300" : "text-text-subtle"}`}>{r.spawn_damage_by?.[p.in_game_player_id] ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-text-subtle">Cross-check vs CSV</p>
          <label className="inline-flex cursor-pointer items-center gap-2 border border-border px-3 py-1 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-text-muted hover:text-text">
            Upload round CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsv} />
          </label>
          <span className="text-[0.65rem] text-text-subtle">Verifies parsed counters match the LaserWar CSV export for this round.</span>
        </div>
        {csvResult && (
          csvResult.issues.length === 0 ? (
            <p className="mt-2 text-xs text-emerald-300">✓ {csvResult.checked} players — all counters match the CSV exactly.</p>
          ) : (
            <div className="mt-2 text-xs">
              <p className="text-amber-300">{csvResult.issues.length} mismatch{csvResult.issues.length === 1 ? "" : "es"} across {csvResult.checked} players:</p>
              <ul className="mt-1 space-y-0.5">
                {csvResult.issues.map((m, i) => (
                  <li key={i} className="text-text-muted"><span className="font-semibold text-text">{m.player}</span> · {m.field}: JSON <span className="text-amber-300">{m.json}</span> vs CSV <span className="text-amber-300">{m.csv}</span></li>
                ))}
              </ul>
            </div>
          )
        )}
      </div>

      {streaksByPlayer.size > 0 && (
        <div className="border-t border-border px-4 py-3">
          <p className="mb-2 text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-text-subtle">
            Streaks ({streaks.length})
          </p>
          <div className="space-y-1.5">
            {[...streaksByPlayer.entries()].map(([pid, m]) => (
              <div key={pid} className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="w-24 shrink-0 font-semibold text-text">{playerLabel(pid)}</span>
                {[...m.entries()].map(([name, count]) => (
                  <span key={name} className="border border-accent/40 bg-accent/10 px-2 py-0.5 text-[0.65rem] text-accent">
                    {name}
                    {count > 1 ? ` ×${count}` : ""}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {r.ingestion_flags.length > 0 && (
        <div className="border-t border-border px-4 py-2.5">
          <p className="mb-1 text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-text-subtle">Flags</p>
          <div className="flex flex-wrap gap-1.5">
            {r.ingestion_flags.map((fl, i) => (
              <span key={i} className="border border-amber-700/60 bg-amber-950/30 px-2 py-0.5 text-[0.65rem] text-amber-300">
                {fl.code}
                {fl.detail ? `: ${fl.detail}` : ""}
              </span>
            ))}
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}
