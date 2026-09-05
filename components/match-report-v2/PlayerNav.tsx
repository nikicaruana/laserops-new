"use client";

/**
 * components/match-report/PlayerNav.tsx
 * --------------------------------------------------------------------
 * Makes switching the selected player feel responsive. Selecting a player in
 * the table navigates (updating ?player=), which re-runs the server component -
 * that round-trip can take a moment. We run the navigation inside a transition
 * so `isPending` is true while the new data loads, and PlayerCardArea shows a
 * spinner over the summary until it arrives.
 *
 * PlayersTable rows use `navigate` when a provider is present; otherwise they
 * fall back to plain <Link> (e.g. the Last Match page, which links to profiles).
 */
import { createContext, useContext, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type PlayerNav = { isPending: boolean; navigate: ((href: string) => void) | null };
const PlayerNavContext = createContext<PlayerNav>({ isPending: false, navigate: null });

export function usePlayerNav(): PlayerNav {
  return useContext(PlayerNavContext);
}

export function PlayerNavProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const navigate = (href: string) => {
    startTransition(() => router.push(href, { scroll: false }));
  };
  return <PlayerNavContext.Provider value={{ isPending, navigate }}>{children}</PlayerNavContext.Provider>;
}

/** Wraps the player summary; overlays a spinner while a switch is loading. */
export function PlayerCardArea({ children }: { children: ReactNode }) {
  const { isPending } = usePlayerNav();
  return (
    <div className="relative">
      {isPending && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-sm bg-bg/70 backdrop-blur-[2px]">
          <Spinner />
        </div>
      )}
      {children}
    </div>
  );
}

export function Spinner() {
  return (
    <span
      aria-label="Loading"
      role="status"
      className="inline-block h-10 w-10 animate-spin rounded-full border-[3px] border-border-strong border-t-accent"
    />
  );
}
