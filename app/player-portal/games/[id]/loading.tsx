import { BrandLoader } from "@/components/ui/BrandLoader";

/**
 * Loading UI for a single game's routes (detail / live / join). A fresh Suspense
 * boundary at this segment so navigating INTO a game from the list (e.g. "View
 * live game") shows the spinning brand loader immediately - a parent loading.tsx
 * at the portal level won't re-fire for a deeper route that shares its layout.
 */
export default function Loading() {
  return <BrandLoader />;
}
