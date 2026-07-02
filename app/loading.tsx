import { BrandLoader } from "@/components/ui/BrandLoader";

/**
 * Root loading UI. Next.js shows this instantly on navigation while the
 * destination route's server components render/stream — so clicking a link
 * to a slow page (e.g. a match report) gives immediate feedback instead of
 * the site feeling frozen until the page is ready.
 */
export default function Loading() {
  return <BrandLoader />;
}
