import { BrandLoader } from "@/components/ui/BrandLoader";

/**
 * Loading UI for the leaderboards section.
 * --------------------------------------------------------------------
 * The tab bar (All-Time / Challenges / Hall of Fame) lives in this
 * segment's layout.tsx, which stays mounted while you switch tabs. This
 * loading.tsx is the Suspense fallback for the child page slot, so
 * clicking a tab shows the spinner in the content area — with the tab bar
 * still visible — instead of feeling unresponsive on slow data loads.
 *
 * Without a loading.tsx at this level, the only boundary was the root
 * app/loading.tsx, which never re-fires for navigations that share this
 * layout — so tab clicks gave no feedback at all.
 */
export default function Loading() {
  return <BrandLoader />;
}
