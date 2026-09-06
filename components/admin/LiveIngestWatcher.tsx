"use client";

/**
 * components/admin/LiveIngestWatcher.tsx
 * --------------------------------------------------------------------
 * Live auto-ingest. On the venue tablet (Chrome/Edge on Windows), the admin
 * picks the AlphaTag export folder once; this then polls it and, as each new
 * per-round JSON file finishes writing, uploads it as a round on THIS match —
 * no manual upload, no LaserWar API. Uses the File System Access API (Chromium
 * only) and keeps the screen awake while watching.
 *
 * Files already in the folder when you connect are treated as a baseline and
 * skipped (the folder accumulates past games); only files that appear after you
 * start watching are ingested. "Import existing" pulls the current ones in too.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWakeLock } from "@/lib/hooks/use-wake-lock";

type LogEntry = { at: string; text: string; kind: "ok" | "skip" | "err" };
type FileRec = { size: number; stable: number; done: boolean };

const ROUND_FILE = /\.(json|lwa|txt)$/i;
const POLL_MS = 4000;

// Minimal typing for the File System Access API (not in the TS DOM lib here).
type FsFileHandle = { kind: "file"; name: string; getFile: () => Promise<File> };
type FsDirHandle = {
  name: string;
  values: () => AsyncIterable<FsFileHandle | { kind: "directory"; name: string }>;
  queryPermission?: (o: { mode: string }) => Promise<PermissionState>;
  requestPermission?: (o: { mode: string }) => Promise<PermissionState>;
};

export function LiveIngestWatcher({ matchId, isLive }: { matchId: string; isLive: boolean }) {
  const router = useRouter();
  const [supported, setSupported] = useState(true);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const [count, setCount] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const handleRef = useRef<FsDirHandle | null>(null);
  const seen = useRef<Map<string, FileRec>>(new Map());
  const polling = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useWakeLock(watching);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "showDirectoryPicker" in window);
  }, []);

  const addLog = useCallback((text: string, kind: LogEntry["kind"]) => {
    setLog((l) => [{ at: new Date().toLocaleTimeString("en-GB"), text, kind }, ...l].slice(0, 40));
  }, []);

  const poll = useCallback(async () => {
    const h = handleRef.current;
    if (!h || polling.current) return;
    polling.current = true;
    try {
      for await (const entry of h.values()) {
        if (entry.kind !== "file" || !ROUND_FILE.test(entry.name)) continue;
        const rec = seen.current.get(entry.name) ?? { size: -1, stable: 0, done: false };
        if (rec.done) continue;
        const file = await (entry as FsFileHandle).getFile();
        // Wait until the file stops growing (round finished writing).
        if (file.size > 0 && file.size === rec.size) rec.stable += 1;
        else { rec.stable = 0; rec.size = file.size; }
        seen.current.set(entry.name, rec);
        if (rec.stable < 1) continue;

        const raw = await file.text();
        try {
          const res = await fetch(`/api/matches/${matchId}/ingest-round`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: entry.name, raw }),
          });
          const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; skipped?: string; rounds?: number };
          rec.done = true;
          seen.current.set(entry.name, rec);
          if (!res.ok || data.error) addLog(`${entry.name}: ${data.error || "failed"}`, "err");
          else if (data.skipped) addLog(`${entry.name}: skipped (${data.skipped})`, "skip");
          else {
            setCount((c) => c + 1);
            if (typeof data.rounds === "number") addLog(`${entry.name} → round ${data.rounds} ingested`, "ok");
            else addLog(`${entry.name} ingested`, "ok");
            router.refresh();
          }
        } catch (e) {
          // Leave rec.done false so it retries next poll (e.g. 4G blip).
          addLog(`${entry.name}: ${e instanceof Error ? e.message : "upload error"}`, "err");
        }
      }
    } catch (e) {
      addLog(e instanceof Error ? e.message : "Folder read error", "err");
    } finally {
      polling.current = false;
    }
  }, [matchId, addLog, router]);

  const baseline = useCallback(async () => {
    const h = handleRef.current;
    if (!h) return;
    for await (const entry of h.values()) {
      if (entry.kind === "file" && ROUND_FILE.test(entry.name)) {
        seen.current.set(entry.name, { size: -1, stable: 0, done: true });
      }
    }
  }, []);

  async function connect() {
    setErr(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const h = (await (window as any).showDirectoryPicker({ mode: "read", id: "alphatag-export" })) as FsDirHandle;
      handleRef.current = h;
      setFolderName(h.name);
      seen.current.clear();
      await baseline(); // skip files already there; only ingest new rounds.
      startWatching();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // user cancelled
      setErr(e instanceof Error ? e.message : "Couldn't open the folder.");
    }
  }

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

  async function importExisting() {
    // Clear the baseline "done" flags so the current files get ingested too.
    for (const [name, rec] of seen.current) seen.current.set(name, { ...rec, done: false, stable: 1 });
    addLog("Importing files already in the folder…", "skip");
    await poll();
  }

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  if (!supported) {
    return (
      <p className="border border-amber-700 bg-amber-950/30 px-4 py-3 text-xs text-amber-300">
        Live auto-ingest needs <strong>Chrome or Edge on Windows</strong> (the File System Access API). Open this match page
        in Chrome/Edge on the venue tablet to use it. You can still upload round files by hand under “Ingest data”.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {!isLive && (
        <p className="border border-border bg-bg-elevated px-4 py-2.5 text-xs text-text-muted">
          Tip: start the match (set it <strong>live</strong>) before a game so incoming rounds attach to it. You can still watch now.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {!folderName ? (
          <button
            type="button"
            onClick={connect}
            className="border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98]"
          >
            Connect export folder
          </button>
        ) : (
          <>
            <span className="inline-flex items-center gap-2 text-xs text-text-muted">
              <span className={`h-2 w-2 rounded-full ${watching ? "animate-pulse bg-emerald-400" : "bg-text-subtle"}`} />
              {watching ? "Watching" : "Paused"} · <span className="font-mono text-text">{folderName}</span>
            </span>
            {watching ? (
              <button type="button" onClick={stopWatching} className="border border-border-strong px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
                Pause
              </button>
            ) : (
              <button type="button" onClick={startWatching} className="border border-accent bg-accent px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-bg">
                Resume
              </button>
            )}
            <button type="button" onClick={importExisting} className="border border-border-strong px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
              Import existing files
            </button>
            <button type="button" onClick={connect} className="text-xs font-semibold uppercase tracking-[0.1em] text-text-subtle hover:text-accent">
              Change folder
            </button>
          </>
        )}
      </div>

      <p className="text-[0.7rem] text-text-subtle">
        Rounds ingested this session: <span className="font-mono font-bold text-text">{count}</span>. New round files are picked up
        within a few seconds of each round ending. Keep this tab open; the screen stays awake while watching. Review &amp; publish as usual below.
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
