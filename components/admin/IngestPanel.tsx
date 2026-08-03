"use client";

/**
 * components/admin/IngestPanel.tsx
 * --------------------------------------------------------------------
 * Admin ingest PREVIEW. Drop one or more round JSON files; each is parsed in
 * the browser (pure parser, no upload) and shown as extracted facts — round
 * meta, per-player stats, captures, and any ingestion flags. Nothing is saved:
 * this is the "parse + preview, don't commit" step. Committing stats (writing
 * aggregates + XP/ELO) comes once the parser is validated against a real game
 * file.
 */
import { useState } from "react";
import { parseRound, type Round } from "@/lib/ingestion/round-parser";

type Parsed = { name: string; round?: Round; error?: string };

const th = "px-2 py-2 text-left text-[0.55rem] font-semibold uppercase tracking-[0.1em] text-text-muted";
const td = "px-2 py-1.5 text-sm";

export function IngestPanel() {
  const [files, setFiles] = useState<Parsed[]>([]);
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    setBusy(true);
    const out: Parsed[] = [];
    for (const f of picked) {
      try {
        const text = await f.text();
        out.push({ name: f.name, round: parseRound(text) });
      } catch (err) {
        out.push({ name: f.name, error: err instanceof Error ? err.message : "Couldn't parse this file." });
      }
    }
    setFiles(out);
    setBusy(false);
    e.target.value = "";
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 border border-border bg-bg-elevated px-4 py-4">
        <label className="inline-flex cursor-pointer items-center gap-2 border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-bg">
          {busy ? "Parsing…" : "Choose round file(s)"}
          <input type="file" accept=".json,application/json" multiple onChange={onPick} className="hidden" />
        </label>
        <p className="text-[0.7rem] text-text-subtle">
          One JSON file per round. Parsed in your browser for preview — nothing is saved yet.
        </p>
        {files.length > 0 && (
          <button
            type="button"
            onClick={() => setFiles([])}
            className="ml-auto text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-text-subtle hover:text-accent"
          >
            Clear
          </button>
        )}
      </div>

      {files.map((f, i) => (
        <RoundPreview key={`${f.name}-${i}`} name={f.name} parsed={f} index={i + 1} />
      ))}
    </div>
  );
}

function RoundPreview({ name, parsed, index }: { name: string; parsed: Parsed; index: number }) {
  if (parsed.error || !parsed.round) {
    return (
      <div className="border border-red-800 bg-red-950/40 px-4 py-3">
        <p className="text-sm font-semibold text-red-400">{name}</p>
        <p className="text-xs text-red-400/80">{parsed.error ?? "Parse failed."}</p>
      </div>
    );
  }
  const r = parsed.round;
  const kills = r.events.kills.length;
  const hits = r.events.damage.length;
  const captures = r.events.captures.length;
  const spawnKills = r.ingestion_flags.find((f) => f.code === "spawn_kills")?.detail ?? "0";
  const durationMin = r.meta.duration_seconds != null ? Math.round(r.meta.duration_seconds / 60) : "—";

  const facts: [string, string][] = [
    ["Round", `#${index}`],
    ["Mode", r.scenario.inferred_mode],
    ["Players", String(r.meta.player_count)],
    ["Teams", r.teams.map((t) => t.colour).join(" / ")],
    ["Bases", String(r.bases.length)],
    ["Duration", `${durationMin} min`],
    ["Kills", String(kills)],
    ["Hits", String(hits)],
    ["Captures", String(captures)],
    ["Spawn kills", spawnKills],
  ];

  return (
    <div className="border border-border bg-bg-elevated">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <span className="font-mono text-xs text-text-muted">{name}</span>
        {r.ingestion_flags.length > 0 && (
          <span className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-amber-300">
            {r.ingestion_flags.length} flag{r.ingestion_flags.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-5">
        {facts.map(([k, v]) => (
          <div key={k} className="bg-bg-elevated px-3 py-2">
            <p className="text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-text-subtle">{k}</p>
            <p className="mt-0.5 text-sm font-semibold text-text">{v}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead className="border-b border-border">
            <tr>
              <th className={th}>Headband</th>
              <th className={th}>Name</th>
              <th className={th}>Team</th>
              <th className={`${th} text-right`}>Score</th>
              <th className={`${th} text-right`}>K</th>
              <th className={`${th} text-right`}>D</th>
              <th className={`${th} text-right`}>Hits</th>
              <th className={`${th} text-right`}>Caps</th>
            </tr>
          </thead>
          <tbody>
            {r.players.map((p) => {
              const c = r.final_player_counters[p.in_game_player_id];
              return (
                <tr key={p.in_game_player_id} className="border-b border-border/60 last:border-0">
                  <td className={`${td} font-mono font-semibold text-accent`}>{p.headband_no ?? "—"}</td>
                  <td className={`${td} text-text`}>{p.name}</td>
                  <td className={`${td} text-text-muted`}>{p.team}</td>
                  <td className={`${td} text-right font-mono tabular-nums text-text`}>{c?.score ?? 0}</td>
                  <td className={`${td} text-right font-mono tabular-nums text-text-muted`}>{c?.frags ?? 0}</td>
                  <td className={`${td} text-right font-mono tabular-nums text-text-muted`}>{c?.deaths ?? 0}</td>
                  <td className={`${td} text-right font-mono tabular-nums text-text-muted`}>{c?.hits ?? 0}</td>
                  <td className={`${td} text-right font-mono tabular-nums text-text-muted`}>{c?.captures ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
    </div>
  );
}
