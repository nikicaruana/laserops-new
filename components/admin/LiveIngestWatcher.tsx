"use client";

/**
 * components/admin/LiveIngestWatcher.tsx
 * --------------------------------------------------------------------
 * Live feed producer. On the venue tablet (Chrome/Edge on Windows), the admin
 * picks the AlphaTag export folder once; this then, every couple of seconds:
 *   1. reads the current (growing) round file, builds a compact snapshot, and
 *      upserts it to match_live_state — players' phones + the public view render
 *      it in near-real-time (a few seconds' delay).
 *   2. when a round file stops growing (round finished), uploads it as a
 *      completed round for scoring/publishing.
 * Files already in the folder at connect are a baseline (the folder accumulates
 * past games); only files that appear afterwards are this match's rounds.
 * Uses the File System Access API (Chromium only) + keeps the screen awake.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useWakeLock } from "@/lib/hooks/use-wake-lock";
import { buildLiveRound, type RoundResolvers } from "@/lib/live-sim/build-round";
import { buildSnapshot } from "@/lib/live-sim/engine";
import { hbKey } from "@/lib/ingestion/roster";

type LogEntry = { at: string; text: string; kind: "ok" | "skip" | "err" };
type FileRec = { roundNo: number; size: number; stable: number; ingested: boolean; pushedSize: number };
type FsFileHandle = { kind: "file"; name: string; getFile: () => Promise<File> };
type FsDirHandle = { name: string; values: () => AsyncIterable<FsFileHandle | { kind: "directory"; name: string }> };

const ROUND_FILE = /\.(json|lwa|txt)$/i;
const POLL_MS = 2000;

export function LiveIngestWatcher({ matchId, isLive }: { matchId: string; isLive: boolean }) {
  const router = useRouter();
  const [supported, setSupported] = useState(true);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const [liveRounds, setLiveRounds] = useState(0);
  const [ingested, setIngested] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const handleRef = useRef<FsDirHandle | null>(null);
  const resolvers = useRef<RoundResolvers | null>(null);
  const baseline = useRef<Set<string>>(new Set());
  const rounds = useRef<Map<string, FileRec>>(new Map());
  const counter = useRef(0);
  const polling = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useWakeLock(watching);

  useEffect(() => { setSupported(typeof window !== "undefined" && "showDirectoryPicker" in window); }, []);

  const addLog = useCallback((text: string, kind: LogEntry["kind"]) => {
    setLog((l) => [{ at: new Date().toLocaleTimeString("en-GB"), text, kind }, ...l].slice(0, 50));
  }, []);

  const loadRoster = useCallback(async () => {
    const supabase = createClient();
    const [{ data: parts }, { data: guns }] = await Promise.all([
      supabase.from("match_participants").select("headset_label, account_id, gun_used").eq("match_id", matchId),
      supabase.from("guns").select("name, image_url"),
    ]);
    const accIds = [...new Set((parts ?? []).map((p) => p.account_id).filter(Boolean) as string[])];
    const { data: accs } = accIds.length ? await supabase.from("accounts").select("id, ops_tag").in("id", accIds) : { data: [] as { id: string; ops_tag: string | null }[] };
    const opsById = new Map((accs ?? []).map((a) => [a.id as string, a.ops_tag as string | null]));
    const gunImg = new Map(((guns ?? []) as { name: string; image_url: string | null }[]).map((g) => [g.name, g.image_url ?? ""]));
    const partByHb = new Map<string, { account_id: string | null; gun_used: string | null }>();
    for (const p of parts ?? []) { const k = hbKey(p.headset_label as string); if (k) partByHb.set(k, p as { account_id: string | null; gun_used: string | null }); }
    resolvers.current = {
      nameOf: (hb) => { const p = partByHb.get(hbKey(hb)); const ops = p?.account_id ? opsById.get(p.account_id) : null; return ops || hb; },
      gunOf: (hb) => { const p = partByHb.get(hbKey(hb)); const g = p?.gun_used || ""; return { name: g, image: g ? gunImg.get(g) ?? "" : "" }; },
    };
  }, [matchId]);

  const poll = useCallback(async () => {
    const h = handleRef.current, res = resolvers.current;
    if (!h || !res || polling.current) return;
    polling.current = true;
    const supabase = createClient();
    try {
      // Snapshot the current round files.
      const files: { name: string; file: File }[] = [];
      for await (const entry of h.values()) {
        if (entry.kind === "file" && ROUND_FILE.test(entry.name)) files.push({ name: entry.name, file: await (entry as FsFileHandle).getFile() });
      }
      // Register new (post-baseline) files as this match's rounds, in appearance order.
      const fresh = files.filter((f) => !baseline.current.has(f.name)).sort((a, b) => a.file.lastModified - b.file.lastModified);
      for (const f of fresh) {
        if (!rounds.current.has(f.name)) {
          rounds.current.set(f.name, { roundNo: ++counter.current, size: -1, stable: 0, ingested: false, pushedSize: -1 });
          setLiveRounds(counter.current);
          addLog(`Round ${counter.current} started (${f.name})`, "ok");
        }
        const rec = rounds.current.get(f.name)!;
        if (f.file.size > 0 && f.file.size === rec.size) rec.stable += 1; else { rec.stable = 0; rec.size = f.file.size; }
        rounds.current.set(f.name, rec);
      }

      // Live stream: the most-recently-modified fresh file is the current round.
      // Push only when it has grown since the last push (timers still tick locally
      // on phones between pushes) — no writes/egress during lulls.
      const active = fresh[fresh.length - 1];
      if (active) {
        const rec = rounds.current.get(active.name)!;
        if (active.file.size !== rec.pushedSize) {
          const built = buildLiveRound(await active.file.text(), rec.roundNo, res);
          if (built) {
            const maxEv = built.round.events.reduce((m, e) => Math.max(m, e.t), 0);
            const elapsed = Math.max(Date.now() / 1000 - built.startEpoch, maxEv);
            const snapshot = buildSnapshot(built.round, elapsed); // compact — precomputed, ~few KB
            const { error } = await supabase.from("match_live_state").upsert({
              match_id: matchId, round_no: rec.roundNo, elapsed_seconds: Math.round(elapsed),
              snapshot, server_ts: new Date().toISOString(),
            });
            if (error) addLog(`live push failed: ${error.message}`, "err");
            else { rec.pushedSize = active.file.size; rounds.current.set(active.name, rec); }
          }
        }
      }

      // Scoring ingest: a fresh file that stopped growing = a finished round.
      for (const f of fresh) {
        const rec = rounds.current.get(f.name)!;
        if (rec.ingested || rec.stable < 2) continue;
        try {
          const res2 = await fetch(`/api/matches/${matchId}/ingest-round`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: f.name, raw: await f.file.text() }),
          });
          const data = (await res2.json().catch(() => ({}))) as { ok?: boolean; error?: string; skipped?: string };
          rec.ingested = true; rounds.current.set(f.name, rec);
          if (data.ok && !data.skipped) { setIngested((n) => n + 1); addLog(`Round ${rec.roundNo} saved for scoring`, "ok"); router.refresh(); }
          else if (data.error) addLog(`Round ${rec.roundNo}: ${data.error}`, "err");
        } catch (e) { addLog(`Round ${rec.roundNo} ingest: ${e instanceof Error ? e.message : "error"}`, "err"); }
      }
    } catch (e) {
      addLog(e instanceof Error ? e.message : "Folder read error", "err");
    } finally {
      polling.current = false;
    }
  }, [matchId, addLog, router]);

  function startWatching() {
    if (timer.current) clearInterval(timer.current);
    setWatching(true);
    void poll();
    timer.current = setInterval(() => void poll(), POLL_MS);
  }
  function stopWatching() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setWatching(false);
  }

  async function connect() {
    setErr(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const h = (await (window as any).showDirectoryPicker({ mode: "read", id: "alphatag-export" })) as FsDirHandle;
      handleRef.current = h;
      setFolderName(h.name);
      await loadRoster();
      // Baseline the files already there (past games) so only new rounds ingest.
      baseline.current = new Set();
      rounds.current.clear();
      counter.current = 0;
      setLiveRounds(0); setIngested(0);
      for await (const entry of h.values()) if (entry.kind === "file" && ROUND_FILE.test(entry.name)) baseline.current.add(entry.name);
      startWatching();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setErr(e instanceof Error ? e.message : "Couldn't open the folder.");
    }
  }

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  if (!supported) {
    return (
      <p className="border border-amber-700 bg-amber-950/30 px-4 py-3 text-xs text-amber-300">
        Live auto-ingest needs <strong>Chrome or Edge on Windows</strong> (the File System Access API). Open this match page
        in Chrome/Edge on the venue tablet. You can still upload round files by hand under “Ingest data”.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {!isLive && (
        <p className="border border-border bg-bg-elevated px-4 py-2.5 text-xs text-text-muted">
          Tip: set the match <strong>live</strong> before the game so players can open their live view.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {!folderName ? (
          <button type="button" onClick={connect} className="border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98]">
            Connect export folder
          </button>
        ) : (
          <>
            <span className="inline-flex items-center gap-2 text-xs text-text-muted">
              <span className={`h-2 w-2 rounded-full ${watching ? "animate-pulse bg-emerald-400" : "bg-text-subtle"}`} />
              {watching ? "Streaming live" : "Paused"} · <span className="font-mono text-text">{folderName}</span>
            </span>
            {watching
              ? <button type="button" onClick={stopWatching} className="border border-border-strong px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-text-muted hover:text-accent">Pause</button>
              : <button type="button" onClick={startWatching} className="border border-accent bg-accent px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-bg">Resume</button>}
            <button type="button" onClick={connect} className="text-xs font-semibold uppercase tracking-[0.1em] text-text-subtle hover:text-accent">Change folder</button>
          </>
        )}
      </div>

      <p className="text-[0.7rem] text-text-subtle">
        Rounds this session — live: <span className="font-mono font-bold text-text">{liveRounds}</span> · saved for scoring: <span className="font-mono font-bold text-text">{ingested}</span>.
        Players see the feed within a few seconds. Keep this tab open; the screen stays awake while streaming. Review &amp; publish stay manual below.
      </p>
      {err && <p className="text-xs text-red-400">{err}</p>}

      {log.length > 0 && (
        <div className="max-h-56 overflow-y-auto border border-border bg-bg">
          <ul className="divide-y divide-border/60 text-xs">
            {log.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-3 py-1.5">
                <span className={e.kind === "ok" ? "text-emerald-300" : e.kind === "err" ? "text-red-400" : "text-text-subtle"}>{e.text}</span>
                <span className="shrink-0 font-mono text-[0.6rem] text-text-subtle">{e.at}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
