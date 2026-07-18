import { BrandLoader } from "@/components/ui/BrandLoader";

/**
 * Loading UI for the player-stats section.
 * --------------------------------------------------------------------
 * The tab bar (Summary / Armory / Compare / History / Last Match) lives in
 * this segment's layout.tsx and stays mounted while you switch tabs. This
 * loading.tsx is the Suspense fallback for the child page slot, so a tab
 * click shows the spinner in the content area (tab bar still visible)
 * instead of feeling frozen while the new tab's data loads.
 */
export default function Loading() {
  return <BrandLoader />;
}
