"use client";

/**
 * components/live/LiveFeedClient.tsx
 * --------------------------------------------------------------------
 * Subscribes to a match's live snapshot (match_live_state, Supabase Realtime)
 * and renders LiveRoundView. The producer pushes a snapshot with `elapsed_seconds`
 * every couple of seconds; between pushes we advance the clock locally from wall
 * time so base timers tick smoothly (the feed is inherently a few seconds behind
 * real play). Player mode is personalised to `me`; public mode is a spectator feed.
 */
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWakeLock } from "@/lib/hooks/use-wake-lock";
import { LiveRoundView } from "@/components/live/LiveRoundView";
import type { LiveSnapshot } from "@/lib/live-sim/engine";

type Snap = { snapshot: LiveSnapshot; elapsed_seconds: number | null; round_no: number | null; server_ts: string };

export function LiveFeedClient({
  matchId, mode, me = null, title,
}: {
  matchId: string;
  mode: "player" | "public";
  me?: string | null;
  title?: string;
}) {
  const [data, setData] = useState<LiveSnapshot | null>(null);
  const [roundNo, setRoundNo] = useState<number | null>(null);
  const [t, setT] = useState(0);
  const [connected, setConnected] = useState(false);
  const [taunts, setTaunts] = useState<{ from: string; id: string }[]>([]);
  // Base for local clock extrapolation: elapsed at the last snapshot + when we got it.
  const base = useRef<{ elapsed: number; recvMs: number }>({ elapsed: 0, recvMs: Date.now() });
  // Broadcast channel for live taunts (ephemeral — no DB writes/egress).
  const tauntCh = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  useWakeLock(mode === "player");

  // Taunts: player mode only. Subscribe to the match's broadcast channel and
  // collect the ones aimed at me; expose a sender for the 🖕 button.
  useEffect(() => {
    if (mode !== "player" || !me) return;
    const supabase = createClient();
    const ch = supabase.channel(`taunt:${matchId}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "taunt" }, ({ payload }) => {
      const p = payload as { from?: string; to?: string };
      if (p?.to === me && p.from) setTaunts((prev) => [...prev, { from: p.from!, id: `${Date.now()}-${Math.random()}` }].slice(-20));
    }).subscribe();
    tauntCh.current = ch;
    return () => { supabase.removeChannel(ch); tauntCh.current = null; };
  }, [mode, me, matchId]);

  const sendTaunt = (to: string) => {
    if (!me || !tauntCh.current) return;
    tauntCh.current.send({ type: "broadcast", event: "taunt", payload: { from: me, to } });
  };

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const apply = (row: Snap | null) => {
      if (!active || !row?.snapshot) return;
      setData(row.snapshot);
      setRoundNo(row.round_no);
      base.current = { elapsed: row.elapsed_seconds ?? 0, recvMs: Date.now() };
      setT(row.elapsed_seconds ?? 0);
    };

    supabase
      .from("match_live_state")
      .select("snapshot, elapsed_seconds, round_no, server_ts")
      .eq("match_id", matchId)
      .maybeSingle()
      .then(({ data: row }) => apply(row as Snap | null));

    const channel = supabase
      .channel(`live:${matchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_live_state", filter: `match_id=eq.${matchId}` },
        (payload) => apply(payload.new as Snap))
      .subscribe((status) => { if (active) setConnected(status === "SUBSCRIBED"); });

    return () => { active = false; supabase.removeChannel(channel); };
  }, [matchId]);

  // Local clock: tick between snapshots so timers advance smoothly.
  useEffect(() => {
    if (!data) return;
    const iv = setInterval(() => {
      setT(base.current.elapsed + (Date.now() - base.current.recvMs) / 1000);
    }, 250);
    return () => clearInterval(iv);
  }, [data]);

  if (!data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-text-muted">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
          {connected ? "Waiting for the match to go live…" : "Connecting…"}
        </span>
        <p className="max-w-xs text-xs text-text-subtle">This updates automatically the moment the first round starts.</p>
      </div>
    );
  }

  return (
    <div className="px-3 py-3">
      {title && <p className="mb-2 text-center text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-text-subtle">{title}</p>}
      <LiveRoundView snap={data} t={t} mode={mode} me={me} roundLabel={roundNo ? `Round ${roundNo}` : undefined} onTaunt={sendTaunt} incomingTaunts={taunts} />
    </div>
  );
}
