import { BrandLoader } from "@/components/ui/BrandLoader";

/** Loading boundary for this admin detail route (fresh Suspense boundary so
 *  clicking into a detail from the list shows the brand loader immediately). */
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <BrandLoader />
    </div>
  );
}
