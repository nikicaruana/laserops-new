"use client";

/**
 * components/layout/LiveGameButton.tsx
 * --------------------------------------------------------------------
 * Header CTA that appears only when the signed-in player has a game LIVE right
 * now (joined or registered) — a big, pulsing "Live Game" button next to the
 * notification bell so players on their phones jump straight to the in-match
 * scores. Polls lightly + on focus; renders nothing when there is no live game.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

type LiveGame = { id: string; title: string | null } | null;

export function LiveGameButton() {
  const [game, setGame] = useState<LiveGame>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/portal/live-game", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { match: LiveGame };
        if (alive) setGame(j.match ?? null);
      } catch {
        /* ignore */
      }
    };
    load();
    const iv = setInterval(load, 30000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      alive = false;
      clearInterval(iv);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  if (!game) return null;

  return (
    <Link
      href={`/player-portal/games/${game.id}/live`}
      className="inline-flex h-11 items-center gap-1.5 border border-accent bg-accent px-3 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-bg transition-colors hover:bg-accent-soft"
      aria-label="Go to your live game"
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bg" />
      Live Game
    </Link>
  );
}
