"use client";
/**
 * components/layout/SiteAmbientBackground.tsx
 * --------------------------------------------------------------------
 * Mounts the ambient PortalBackground behind every route EXCEPT the ones that
 * keep the flat-black treatment: the homepage ("/"), the /play landing page,
 * and the whole admin section. The background is a fixed z-[-1] backdrop, so
 * it sits behind all page content and chrome (header/footer) automatically —
 * content only needs a non-opaque surface for it to show through.
 */
import { usePathname } from "next/navigation";
import { PortalBackground } from "@/components/portal/PortalBackground";

function keepsFlatBlack(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  );
}

export function SiteAmbientBackground() {
  const pathname = usePathname();
  if (!pathname || keepsFlatBlack(pathname)) return null;
  return <PortalBackground />;
}
