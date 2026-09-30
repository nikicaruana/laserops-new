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
import { isLwa, lwaToCsv, lwaPlayerCounters, lwaMatchPlayers } from "@/lib/ingestion/lwa";
import type { ScoreFormula } from "@/lib/scoring/formula";
import { createClient } from "@/lib/supabase/client";

const OPERATOR_ID = "00000000-0000-0000-0000-000000000001";

export type SavedRound = { id: string; filename: string | null; parsed: Round; resolutions: RoundResolutions; winner_override: string | null };

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
  const [winnerOverrides, setWinnerOverrides] = useState<Record<string, string | null>>(
    () => Object.fromEntries(rounds.map((r) => [r.id, r.winner_override ?? null])),
  );
  async function saveWinner(roundId: string, value: string | null) {
    setWinnerOverrides((prev) => ({ ...prev, [roundId]: value }));
    const supabase = createClient();
    const { error: err } = await supabase.from("match_ingest_rounds").update({ winner_override: value }).eq("id", roundId);
    if (err) setError("Couldn't save winner: " + err.message);
  }

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
    let addedOnline = false;
    for (const f of picked) {
      try {
        const text = await f.text();
        if (isLwa(text)) {
          // Offline: one .lwa/CSV aggregate for the WHOLE match. Replaces any
          // existing ingest rows for this match.
          const players = lwaMatchPlayers(text);
          if (players.length === 0) { setError(`${f.name}: no players found in the offline file.`); break; }
          await supabase.from("match_ingest_rounds").delete().eq("match_id", matchId).eq("mode", "offline");
          const { error: errOff } = await supabase.from("match_ingest_rounds").insert({
            operator_id: OPERATOR_ID, match_id: matchId, filename: f.name, raw_file: text, mode: "offline",
          });
          if (errOff) { setError(`${f.name}: ${errOff.message}`); break; }
          await supabase.from("matches").update({ source_file_type: "csv", scoring_mode: "offline", live_feed_enabled: false }).eq("id", matchId);
          break; // offline is a single whole-match file
        }
        const parsed = parseRound(text, { spawnWindowSeconds });
        const { error: err } = await supabase.from("match_ingest_rounds").insert({
          operator_id: OPERATOR_ID,
          match_id: matchId,
          filename: f.name,
          raw_file: text,
          parsed,
          mode: "online",
        });
        if (err) {
          setError(`${f.name}: ${err.message}`);
          break;
        }
        addedOnline = true;
      } catch (err) {
        setError(`${f.name}: ${err instanceof Error ? err.message : "Couldn't parse"}`);
        break;
      }
    }
    // Build + cache the in-match scoreboards now so players see the new
    // round(s) immediately (and their live pages get nudged to refresh).
    if (addedOnline) {
      await fetch(`/api/matches/${matchId}/build-inmatch`, { method: "POST" }).catch(() => {});
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
          <input type="file" accept=".json,.lwa,.csv,application/json" multiple onChange={onPick} className="hidden" disabled={busy} />
        </label>
        <p className="text-[0.7rem] text-text-subtle">
          One JSON file per round (online), or a single .lwa / CSV for a whole offline match. Saved to this match.
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
          winnerOverride={winnerOverrides[sr.id] ?? null}
          onChangeWinner={(v) => saveWinner(sr.id, v)}
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
  winnerOverride,
  onChangeWinner,
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
  winnerOverride: string | null;
  onChangeWinner: (v: string | null) => void;
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
  const effectiveWinner = winnerOverride === "draw" ? null : (winnerOverride || r.result.winner_team);
  const [open, setOpen] = useState(true);
  const [csvResult, setCsvResult] = useState<null | { checked: number; issues: { player: string; field: string; json: number; csv: number }[]; source: string }>(null);
  const [convertedCsv, setConvertedCsv] = useState<{ name: string; text: string } | null>(null);

  // Cross-check the JSON parse against the round's stats export. Accepts the raw
  // LaserWar .lwa file (converted to CSV in-browser) or an already-converted CSV.
  async function handleStatsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    const compareKeys: [string, string][] = [
      ["Frags", "frags"], ["Deaths", "deaths"], ["Hits", "hits"], ["Shots", "shots"],
      ["Wounds", "wounds"], ["Caps", "captures"], ["Revivals", "revivals"],
    ];
    // Build per-nickname counters from either an .lwa file or a CSV.
    let counters: Record<string, Record<string, number>> = {};
    let source = "CSV";
    if (isLwa(text)) {
      source = "LWA";
      counters = lwaPlayerCounters(text);
      setConvertedCsv({ name: f.name.replace(/\.lwa$/i, "") + ".csv", text: lwaToCsv(text) });
    } else {
      setConvertedCsv(null);
      const lines = text.split(/\r?\n/).filter(Boolean);
      const h = lines[0].split(",");
      const col = (n: string) => h.indexOf(n);
      const ni = col("PlayerNickName");
      const csvCols: Record<string, string> = {
        frags: "PlayerFragsCount", deaths: "PlayerDeathsCount", hits: "PlayerHitsCount", shots: "PlayerShotsCount",
        wounds: "PlayerWoundsCount", captures: "PlayerDeviceCapturingsCount", revivals: "PlayerRevivalsCount",
      };
      for (const line of lines.slice(1)) {
        const cols = line.split(",");
        const nick = (cols[ni] ?? "").trim();
        if (!nick) continue;
        const o: Record<string, number> = {};
        for (const [k, cc] of Object.entries(csvCols)) o[k] = parseInt(cols[col(cc)] ?? "") || 0;
        counters[nick] = o;
      }
    }
    const issues: { player: string; field: string; json: number; csv: number }[] = [];
    let checked = 0;
    for (const pl of r.players) {
      const cmp = counters[pl.name];
      const c = r.final_player_counters?.[pl.in_game_player_id];
      if (!cmp || !c) continue;
      checked++;
      for (const [label, key] of compareKeys) {
        const jsonVal = (c as Record<string, number>)[key] ?? 0;
        const cmpVal = cmp[key] ?? 0;
        if (jsonVal !== cmpVal) issues.push({ player: pl.name, field: label, json: jsonVal, csv: cmpVal });
      }
    }
    setCsvResult({ checked, issues, source });
    e.target.value = "";
  }

  function downloadConverted() {
    if (!convertedCsv) return;
    const blob = new Blob([convertedCsv.text], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = convertedCsv.name;
    a.click();
    URL.revokeObjectURL(url);
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-border bg-bg-overlay px-4 py-3.5">
        <button type="button" onClick={() => setOpen((o) => !o)} className="group flex items-center gap-3 text-left hover:opacity-90" aria-expanded={open}>
          <span className="text-2xl leading-none text-accent transition-transform">{open ? "▾" : "▸"}</span>
          <span className="flex flex-col">
            <span className="font-mono text-sm font-bold text-text">{name}</span>
            <span className="text-[0.6rem] uppercase tracking-[0.12em] text-text-subtle">{open ? "Click to collapse" : "Click to expand"}</span>
          </span>
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

      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
        <span className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-text-muted">Round winner</span>
        <span className={effectiveWinner ? "rounded px-2 py-0.5 text-xs font-bold uppercase tracking-[0.08em] bg-accent/15 text-accent" : "rounded px-2 py-0.5 text-xs font-bold uppercase tracking-[0.08em] bg-bg text-text-subtle"}>
          {effectiveWinner ?? "Draw / no winner"}
        </span>
        <select
          value={winnerOverride ?? ""}
          onChange={(e) => onChangeWinner(e.target.value === "" ? null : e.target.value)}
          className="h-9 rounded-none border border-border-strong bg-bg px-2 text-xs text-text focus:border-accent focus:outline-none"
        >
          <option value="">{r.result.winner_team ? "Auto (base control: " + r.result.winner_team + ")" : "Auto (no base-control winner)"}</option>
          {r.teams.map((tm) => (
            <option key={tm.colour} value={tm.colour}>{tm.colour} won</option>
          ))}
          <option value="draw">Draw / no winner</option>
        </select>
        {winnerOverride ? <span className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-amber-300">Overridden</span> : null}
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

      <div className="border-t-2 border-accent/50 bg-accent/5 px-4 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Cross-check vs LWA / CSV</p>
          <label className="inline-flex cursor-pointer items-center gap-2 border border-accent bg-accent px-4 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-bg hover:bg-accent-soft">
            Upload round file (.lwa / .csv)
            <input type="file" accept=".lwa,.csv,.json,text/csv,application/json" className="hidden" onChange={handleStatsFile} />
          </label>
          {convertedCsv && (
            <button type="button" onClick={downloadConverted} className="inline-flex items-center gap-2 border border-border-strong px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-text-muted hover:text-text">
              ↓ Download converted CSV
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[0.7rem] text-text-muted">
          Upload the round&apos;s <span className="font-semibold text-text">.lwa</span> export straight from the game — it&apos;s converted to CSV here (no external script needed) and its counters are checked against the parsed JSON.
        </p>
        {csvResult && (
          csvResult.issues.length === 0 ? (
            <p className="mt-2 text-sm font-semibold text-emerald-300">✓ {csvResult.checked} players — all counters match the {csvResult.source} exactly.</p>
          ) : (
            <div className="mt-2 text-xs">
              <p className="font-semibold text-amber-300">{csvResult.issues.length} mismatch{csvResult.issues.length === 1 ? "" : "es"} across {csvResult.checked} players (vs {csvResult.source}):</p>
              <ul className="mt-1 space-y-0.5">
                {csvResult.issues.map((m, i) => (
                  <li key={i} className="text-text-muted"><span className="font-semibold text-text">{m.player}</span> · {m.field}: JSON <span className="text-amber-300">{m.json}</span> vs file <span className="text-amber-300">{m.csv}</span></li>
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
