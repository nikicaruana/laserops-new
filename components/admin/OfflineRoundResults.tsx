"use client";

/**
 * components/admin/OfflineRoundResults.tsx
 * --------------------------------------------------------------------
 * The offline portion of a match, in one place: the offline file summary +
 * per-round teams and winners. Offline .lwa files carry no winner (LaserWar's
 * IsWinner is blank; Domination is decided by base control, which offline files
 * don't record), so the marshal enters each offline round's result here.
 *
 * For a 1v1v1 round robin only two of the three teams play any given round, so
 * each round also records the two teams that took part. That lets the scorer know
 * how many rounds each team actually played (so a team that sits a round out isn't
 * charged a loss). For an ordinary two-team game the teams can be left blank and
 * every team is assumed to have played every round.
 *
 * Round numbering is CONTINUOUS with the online rounds: if K online JSON rounds
 * were played first, the offline rounds are numbered K+1, K+2, ... (startRound =
 * K+1). Winners save to matches.offline_round_results, the per-round teams to
 * matches.offline_round_teams (both offline-only, in order).
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
  initialTeams = [],
  startRound = 1,
  offlineFile = null,
}: {
  matchId: string;
  teamColours: string[];
  initial: (string | null)[];
  /** Participating team colours per offline round, parallel to `initial`. */
  initialTeams?: string[][];
  /** First offline round number = (online round count) + 1. */
  startRound?: number;
  offlineFile?: { id: string; filename: string | null; playerCount: number } | null;
}) {
  const router = useRouter();
  const initialCount = initial.length || 3;
  const [winners, setWinners] = useState<(string | null)[]>(() =>
    Array.from({ length: initialCount }, (_, i) => initial[i] ?? null),
  );
  const [teams, setTeams] = useState<string[][]>(() =>
    Array.from({ length: initialCount }, (_, i) => {
      const t = initialTeams[i] ?? [];
      return [t[0] ?? "", t[1] ?? ""];
    }),
  );
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
    setTeams((prev) => {
      const next = prev.slice(0, count);
      while (next.length < count) next.push(["", ""]);
      return next;
    });
    setMsg(null);
  }

  // Participants chosen for a round (unique, non-empty).
  const participantsOf = (i: number) => [...new Set((teams[i] ?? []).filter(Boolean))];
  // Winner options = the round's two teams, or all colours if none picked yet.
  const winnerOptions = (i: number) => {
    const p = participantsOf(i);
    return p.length ? p : teamColours;
  };

  function setParticipant(i: number, slot: 0 | 1, colour: string) {
    setTeams((prev) => prev.map((t, idx) => (idx === i ? [slot === 0 ? colour : (t[0] ?? ""), slot === 1 ? colour : (t[1] ?? "")] : t)));
    // If the current winner is no longer one of the two teams, clear it.
    setWinners((prev) =>
      prev.map((w, idx) => {
        if (idx !== i || !w) return w;
        const next = slot === 0 ? [colour, teams[i]?.[1] ?? ""] : [teams[i]?.[0] ?? "", colour];
        const p = [...new Set(next.filter(Boolean))];
        return p.length === 2 && !p.includes(w) ? null : w;
      }),
    );
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
    const teamsPayload = teams.map((t) => [...new Set(t.filter(Boolean))]);
    const { error } = await supabase
      .from("matches")
      .update({ offline_round_results: winners, offline_round_teams: teamsPayload })
      .eq("id", matchId);
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
  // Warn when a round has two teams but the winner isn't one of them.
  const mismatch = winners.some((w, i) => {
    const p = participantsOf(i);
    return w != null && p.length === 2 && !p.includes(w);
  });

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

      <p className="text-[0.7rem] text-text-subtle">
        For a round robin, pick the two teams that played each round and the winner. For a standard two-team game you can
        leave the teams blank and just set the winner.
      </p>

      <div className="space-y-2">
        {winners.map((w, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <span className="w-20 text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Round {startRound + i}</span>
            <select value={teams[i]?.[0] ?? ""} onChange={(e) => setParticipant(i, 0, e.target.value)} className={`${sel} min-w-[7.5rem]`} aria-label={`Round ${startRound + i} team A`}>
              <option value="">Team…</option>
              {teamColours.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <span className="text-xs text-text-subtle">vs</span>
            <select value={teams[i]?.[1] ?? ""} onChange={(e) => setParticipant(i, 1, e.target.value)} className={`${sel} min-w-[7.5rem]`} aria-label={`Round ${startRound + i} team B`}>
              <option value="">Team…</option>
              {teamColours.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <span className="text-xs text-text-subtle">won by</span>
            <select value={w ?? ""} onChange={(e) => setWinner(i, e.target.value)} className={`${sel} min-w-[9rem]`} aria-label={`Round ${startRound + i} winner`}>
              <option value="">Draw / no winner</option>
              {winnerOptions(i).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {mismatch && (
        <p className="text-xs text-amber-400">A round&rsquo;s winner isn&rsquo;t one of its two teams. Fix the teams or the winner before saving.</p>
      )}

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
