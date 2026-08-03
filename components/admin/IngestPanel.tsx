"use client";

/**
 * components/admin/IngestPanel.tsx
 * --------------------------------------------------------------------
 * Admin ingest PREVIEW + STAGING. Drop one or more round JSON files; each is
 * parsed in the browser, then SAVED to match_ingest_rounds (raw file + parsed
 * jsonb) so it survives a refresh. Renders the persisted rounds as extracted
 * facts. Nothing is written to player stats/XP/ELO yet — committing those is a
 * separate, later step gated on real-file validation.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseRound, type Round } from "@/lib/ingestion/round-parser";
import { createClient } from "@/lib/supabase/client";

const OPERATOR_ID = "00000000-0000-0000-0000-000000000001";

export type SavedRound = { id: string; filename: string | null; parsed: Round };

const th = "px-2 py-2 text-left text-[0.55rem] font-semibold uppercase tracking-[0.1em] text-text-muted";
const td = "px-2 py-1.5 text-sm";

const fmtHold = (s: number): string => {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
};

export function IngestPanel({
  matchId,
  rounds,
  headbandLabels = {},
}: {
  matchId: string;
  rounds: SavedRound[];
  headbandLabels?: Record<number, string>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    for (const f of picked) {
      try {
        const text = await f.text();
        const parsed = parseRound(text);
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
          One JSON file per round. Parsed + saved to this match — preview only, no stats written yet.
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
  onRemove,
}: {
  name: string;
  round: Round;
  index: number;
  headbandLabels: Record<number, string>;
  onRemove: () => void;
}) {
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
        <div className="flex items-center gap-3">
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

      <div className="grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-5">
        {facts.map(([k, v]) => (
          <div key={k} className="bg-bg-elevated px-3 py-2">
            <p className="text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-text-subtle">{k}</p>
            <p className="mt-0.5 text-sm font-semibold text-text">{v}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead className="border-b border-border">
            <tr>
              <th className={th}>Headband</th>
              <th className={th}>Player</th>
              <th className={th}>Team</th>
              <th className={`${th} text-right`} title="The game hardware's own score, from the file — NOT the LaserOps scoring formula (that's computed at commit).">
                Game score
              </th>
              <th className={`${th} text-right`}>K</th>
              <th className={`${th} text-right`}>D</th>
              <th className={`${th} text-right`}>Dmg</th>
              <th className={`${th} text-right`}>Caps</th>
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
                  <td className={`${td} font-mono font-semibold text-accent`}>{p.headband_no ?? "—"}</td>
                  <td className={`${td} text-text`}>{label}</td>
                  <td className={`${td} text-text-muted`}>{p.team}</td>
                  <td className={`${td} text-right font-mono tabular-nums text-text`}>{c?.score ?? 0}</td>
                  <td className={`${td} text-right font-mono tabular-nums text-text-muted`}>{c?.frags ?? 0}</td>
                  <td className={`${td} text-right font-mono tabular-nums text-text-muted`}>{c?.deaths ?? 0}</td>
                  <td className={`${td} text-right font-mono tabular-nums text-text-muted`}>{r.damage_dealt?.[p.in_game_player_id] ?? 0}</td>
                  <td className={`${td} text-right font-mono tabular-nums text-text-muted`}>{c?.captures ?? 0}</td>
                  <td className={`${td} text-right font-mono tabular-nums text-text-muted`}>{fmtHold(r.hold_seconds?.[p.in_game_player_id] ?? 0)}</td>
                  <td className={`${td} text-right font-mono tabular-nums ${(r.spawn_kills_by?.[p.in_game_player_id] ?? 0) > 0 ? "text-amber-300" : "text-text-subtle"}`}>{r.spawn_kills_by?.[p.in_game_player_id] ?? 0}</td>
                  <td className={`${td} text-right font-mono tabular-nums ${(r.spawn_damage_by?.[p.in_game_player_id] ?? 0) > 0 ? "text-amber-300" : "text-text-subtle"}`}>{r.spawn_damage_by?.[p.in_game_player_id] ?? 0}</td>
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
