"use client";

/**
 * components/admin/OfflineRoundResults.tsx
 * --------------------------------------------------------------------
 * The offline portion of a match, in one place: the offline file summary +
 * per-round winners. Offline .lwa files carry no winner (LaserWar's IsWinner is
 * blank; Domination is decided by base control, which offline files don't
 * record), so the marshal enters each offline round's winner here.
 *
 * Round numbering is CONTINUOUS with the online rounds: if K online JSON rounds
 * were played first, the offline rounds are numbered K+1, K+2, ... (startRound =
 * K+1). Saved to matches.offline_round_results (winners for the offline rounds
 * only, in order). At publish the online rounds' winners (JSON-derived/overridden)
 * and these are concatenated into the whole-match round sequence.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

const sel =
  "h-10 rounded-none border border-border-strong bg-bg px-3 text-sm text-text focus:border-accent focus:outline-none";

export function OfflineRoundResults({
  matchId,
  teamColours,
  initial,
  startRound = 1,
  offlineFile = null,
}: {
  matchId: string;
  teamColours: string[];
  initial: (string | null)[];
  /** First offline round number = (online round count) + 1. */
  startRound?: number;
  offlineFile?: { id: string; filename: string | null; playerCount: number } | null;
}) {
  const router = useRouter();
  const [winners, setWinners] = useState<(string | null)[]>(() => (initial.length ? [...initial] : [null, null, null]));
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function setCount(n: number) {
    const count = Math.max(1, Math.min(15, n || 1));
    setWinners((prev) => {
      const next = prev.slice(0, count);
      while (next.length < count) next.push(null);
      return next;
    });
    setMsg(null);
  }

  function setWinner(i: number, colour: string) {
    setWinners((prev) => prev.map((w, idx) => (idx === i ? (colour || null) : w)));
    setMsg(null);
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.from("matches").update({ offline_round_results: winners }).eq("id", matchId);
    setBusy(false);
    setMsg({ ok: !error, text: error ? error.message : "Round results saved." });
    if (!error) router.refresh();
  }

  async function removeFile() {
    if (!offlineFile) return;
    if (!window.confirm("Remove the offline file from this match?")) return;
    setRemoving(true);
    const supabase = createClient();
    await supabase.from("match_ingest_rounds").delete().eq("id", offlineFile.id);
    setRemoving(false);
    router.refresh();
  }

  const tally: Record<string, number> = {};
  for (const w of winners) if (w) tally[w] = (tally[w] ?? 0) + 1;
  const count = winners.length;
  const endRound = startRound + count - 1;
  const rangeLabel = count <= 1 ? `Round ${startRound}` : `Rounds ${startRound}–${endRound}`;

  const stepBtn =
    "flex h-11 w-11 shrink-0 items-center justify-center text-xl font-bold text-text-muted transition-colors hover:bg-bg hover:text-accent disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="space-y-5">
      {offlineFile && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-amber-500/40 bg-bg px-4 py-3">
          <div>
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-amber-300">Offline file &middot; {rangeLabel}</p>
            <p className="font-mono text-sm text-text">{offlineFile.filename ?? "offline.lwa"}</p>
            <p className="text-[0.7rem] text-text-subtle">{offlineFile.playerCount} players &middot; scored kill-only across {count === 1 ? "1 round" : `${count} rounds`}.</p>
          </div>
          <button type="button" onClick={removeFile} disabled={removing} className="shrink-0 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-text-subtle hover:text-red-400 disabled:opacity-50">
            {removing ? "Removing…" : "Remove"}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm text-text-muted">
        <span>Number of offline rounds</span>
        <div className="inline-flex items-center overflow-hidden rounded border border-border-strong bg-bg-elevated">
          <button type="button" onClick={() => setCount(count - 1)} disabled={count <= 1} className={stepBtn} aria-label="Fewer rounds">
            &minus;
          </button>
          <span className="flex h-11 w-14 items-center justify-center border-x border-border-strong font-mono text-lg font-bold tabular-nums text-text">
            {count}
          </span>
          <button type="button" onClick={() => setCount(count + 1)} disabled={count >= 15} className={stepBtn} aria-label="More rounds">
            +
          </button>
        </div>
        {startRound > 1 && <span className="text-[0.7rem] text-text-subtle">Rounds 1&ndash;{startRound - 1} are the online rounds above.</span>}
      </div>

      <div className="space-y-2">
        {winners.map((w, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-24 text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Round {startRound + i}</span>
            <select value={w ?? ""} onChange={(e) => setWinner(i, e.target.value)} className={`${sel} min-w-[11rem]`}>
              <option value="">Draw / no winner</option>
              {teamColours.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {Object.keys(tally).length > 0 && (
        <p className="font-mono text-[0.7rem] text-text-subtle">
          {Object.entries(tally).map(([c, n]) => `${c} ${n}`).join(" · ")}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" size="sm" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save round results"}
        </Button>
        {msg && <span className={`text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
