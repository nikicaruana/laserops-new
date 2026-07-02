import { Logo } from "@/components/ui/Logo";

/**
 * BrandLoader
 * --------------------------------------------------------------------
 * Full-area loading indicator: the LaserOps crosshair mark spinning.
 * Rendered by route-level loading.tsx files so a navigation gives instant
 * feedback while the destination server-renders, instead of the page
 * appearing frozen until it's ready.
 *
 * Respects prefers-reduced-motion (the mark stays still, no spin).
 */
export function BrandLoader() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex min-h-[70vh] w-full items-center justify-center px-6"
    >
      <Logo
        variant="icon"
        color="yellow"
        size="xl"
        asLink={false}
        className="animate-spin [animation-duration:1.4s] motion-reduce:animate-none"
      />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
