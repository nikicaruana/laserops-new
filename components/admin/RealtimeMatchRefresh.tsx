"use client";

/**
 * components/admin/RealtimeMatchRefresh.tsx
 * --------------------------------------------------------------------
 * Keeps the match detail page live: subscribes to Supabase Realtime for this
 * match's signups, roster, ingested rounds and the match row itself, and calls
 * router.refresh() (debounced) on any change – so players signing in and live
 * data ingestion show up without a manual reload. Reads honour RLS, so only an
 * admin session receives the events. Renders nothing.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TABLES = ["match_signups", "match_participants", "match_ingest_rounds"] as const;

export function RealtimeMatchRefresh({ matchId }: { matchId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };

    let channel = supabase.channel(`match-${matchId}`);
    for (const table of TABLES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `match_id=eq.${matchId}` },
        refresh,
      );
    }
    channel = channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "matches", filter: `id=eq.${matchId}` },
      refresh,
    );
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [matchId, router]);

  return null;
}
