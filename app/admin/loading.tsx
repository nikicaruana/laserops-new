import { BrandLoader } from "@/components/ui/BrandLoader";

/**
 * Loading UI for the admin area.
 * --------------------------------------------------------------------
 * The admin shell (sidebar nav) lives in layout.tsx and stays mounted, so
 * this is the Suspense fallback for the page slot — clicking between admin
 * pages shows the brand loader in the content area instead of feeling frozen.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <BrandLoader />
    </div>
  );
}
