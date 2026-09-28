import { BrandLoader } from "@/components/ui/BrandLoader";

/**
 * Loading UI for the player portal.
 * --------------------------------------------------------------------
 * app/player-portal/layout.tsx is a persistent shell that stays mounted
 * across every portal navigation (games, squads, ladders, profile, portal
 * home, onboarding, etc.). This loading.tsx is the Suspense fallback for its
 * child page slot, so moving between those pages shows the spinning brand
 * loader instead of feeling frozen while the destination server-renders.
 *
 * Without a loading.tsx at this level the only boundary was the root
 * app/loading.tsx, which sits ABOVE this shared layout and never re-fires for
 * navigations that keep it mounted – so most in-portal transitions had no
 * feedback. The leaderboards and player-stats sub-sections add their own
 * deeper loading.tsx for their tab strips; this covers everything else.
 */
export default function Loading() {
  return <BrandLoader />;
}
