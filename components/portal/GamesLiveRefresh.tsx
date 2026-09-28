"use client";

/**
 * components/portal/GamesLiveRefresh.tsx
 * --------------------------------------------------------------------
 * Keeps the Game Portal list current: subscribes to the matches the player can
 * see (open + theirs) and calls router.refresh() (debounced) when any of them
 * changes – so a game flipping to LIVE shows its "Join game" button instantly,
 * without waiting on a reload or the notification-bell poll. Reads honour RLS.
 * Renders nothing.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function GamesLiveRefresh({
  matchIds,
  watchSignupsFor,
}: {
  matchIds: string[];
  /** Also refresh on signup changes for this match (e.g. payment landing). */
  watchSignupsFor?: string;
}) {
  const router = useRouter();
  // Stable dependency key so the effect only re-subscribes when the set changes.
  const key = [...matchIds].sort().join(",");
  useEffect(() => {
    if (!key) return;
    const ids = key.split(",");
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };

    let channel = supabase.channel(`games-live-${ids[0]}`);
    for (const id of ids) {
      channel = channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${id}` },
        refresh,
      );
    }
    if (watchSignupsFor) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_signups", filter: `match_id=eq.${watchSignupsFor}` },
        refresh,
      );
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [key, watchSignupsFor, router]);

  return null;
}
