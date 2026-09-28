"use client";

/**
 * components/portal/LiveRosterRefresh.tsx
 * --------------------------------------------------------------------
 * Player-side realtime for the live game view: subscribes to this match's
 * participant roster and the match row itself, and calls router.refresh()
 * (debounced) on any change – so new players joining appear live and the page
 * flips when the game ends. Reads honour RLS; the live-roster policy lets a
 * registered player receive other players' join events. Renders nothing.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LiveRosterRefresh({ matchId }: { matchId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };

    const channel = supabase
      .channel(`live-${matchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_participants", filter: `match_id=eq.${matchId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `id=eq.${matchId}` }, refresh)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [matchId, router]);

  return null;
}
